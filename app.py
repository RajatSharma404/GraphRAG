import uvicorn
"""
GraphRAG Web Application Server
FastAPI backend providing REST endpoints for document ingestion, graph querying, and 3D visualization.
"""

import os
import time
import shutil
import tempfile
from collections import defaultdict
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from src.pipeline import GraphRAGPipeline

app = FastAPI(
    title="Hybrid GraphRAG Studio",
    version="1.1.0",
    description="Enterprise Knowledge Graph RAG API with Louvain Community Detection and Dual-Mode Retrieval"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# Rate Limiter Middleware: sliding window (120 req/min per IP on /api)
RATE_LIMIT_MAX = 120
RATE_LIMIT_WINDOW = 60
client_request_history: Dict[str, List[float]] = defaultdict(list)

@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()
        client_request_history[client_ip] = [
            t for t in client_request_history[client_ip] if now - t < RATE_LIMIT_WINDOW
        ]
        if len(client_request_history[client_ip]) >= RATE_LIMIT_MAX:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please throttle your queries."}
            )
        client_request_history[client_ip].append(now)
    return await call_next(request)

pipeline = GraphRAGPipeline()

# Request Models
class QueryRequest(BaseModel):
    query: str = Field(..., description="Natural language question or investigation query")
    mode: str = Field(default="local", description="'local' for entity-centric search, 'global' for thematic dataset search")

class TextIngestRequest(BaseModel):
    title: str = Field(..., description="Document or snippet title")
    content: str = Field(..., description="Raw text content to extract entities and relations from")

# Response Models
class HealthResponse(BaseModel):
    status: str
    neo4j: bool
    node_count: int
    edge_count: int
    community_count: int

class GraphNode(BaseModel):
    id: str
    type: Optional[str] = "CONCEPT"
    desc: Optional[str] = ""
    group: Optional[int] = 1
    chunk_count: Optional[int] = 0

class GraphLink(BaseModel):
    source: str
    target: str
    label: Optional[str] = "RELATED_TO"
    desc: Optional[str] = ""
    weight: Optional[float] = 1.0

class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    links: List[GraphLink]

class QueryResponse(BaseModel):
    query: str
    mode: str
    answer: str

class IngestResponse(BaseModel):
    status: str
    filename: Optional[str] = None
    title: Optional[str] = None

class StatusResponse(BaseModel):
    status: str

@app.get("/api/health", response_model=HealthResponse)
def get_health():
    """Returns database connectivity and graph metrics."""
    neo_ok = pipeline.neo4j.verify_connectivity()
    if not neo_ok:
        return {
            "status": "degraded",
            "neo4j": False,
            "node_count": 0,
            "edge_count": 0,
            "community_count": 0
        }
    
    nodes_res = pipeline.neo4j.execute_query("MATCH (e:Entity) RETURN count(e) AS c")
    edges_res = pipeline.neo4j.execute_query("MATCH ()-[r:RELATED_TO]->() RETURN count(r) AS c")
    comms_res = pipeline.neo4j.execute_query("MATCH (cs:CommunitySummary) RETURN count(cs) AS c")

    return {
        "status": "online",
        "neo4j": True,
        "node_count": nodes_res[0]["c"] if nodes_res else 0,
        "edge_count": edges_res[0]["c"] if edges_res else 0,
        "community_count": comms_res[0]["c"] if comms_res else 0
    }

@app.get("/api/graph", response_model=GraphResponse)
def get_graph():
    """Returns nodes and links formatted for 3D force-directed layout."""
    nodes_query = """
        MATCH (e:Entity)
        OPTIONAL MATCH (e)-[:MENTIONED_IN]->(c:Chunk)
        RETURN 
            e.name AS id, 
            e.type AS type, 
            e.description AS desc, 
            coalesce(e.community_id, 1) AS group,
            count(c) AS chunk_count
    """
    rels_query = """
        MATCH (s:Entity)-[r:RELATED_TO]->(t:Entity)
        RETURN 
            s.name AS source, 
            t.name AS target, 
            r.type AS label, 
            r.description AS desc,
            r.weight AS weight
    """
    nodes = pipeline.neo4j.execute_query(nodes_query)
    rels = pipeline.neo4j.execute_query(rels_query)
    return {"nodes": nodes, "links": rels}

@app.post("/api/query", response_model=QueryResponse)
def execute_query(req: QueryRequest):
    """Executes Local Search or Global Search (synchronous synthesis)."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    
    answer = pipeline.ask(req.query, mode=req.mode)
    return {
        "query": req.query,
        "mode": req.mode,
        "answer": answer
    }

@app.post("/api/query-stream")
@app.post("/api/query/stream")
def execute_query_stream(req: QueryRequest):
    """Executes Local Search or Global Search with live real-time token streaming."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    def stream_tokens():
        for token in pipeline.ask_stream(req.query, mode=req.mode):
            yield token

    return StreamingResponse(stream_tokens(), media_type="text/plain; charset=utf-8")

@app.post("/api/ingest-file", response_model=IngestResponse)
async def ingest_file(file: UploadFile = File(...)):
    """Uploads a PDF or text file and ingests it into the knowledge graph."""
    suffix = os.path.splitext(file.filename)[1].lower()
    if suffix not in [".pdf", ".txt", ".md"]:
        raise HTTPException(status_code=400, detail="Only .pdf, .txt, and .md files are supported.")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        await run_in_threadpool(pipeline.ingest_document, tmp_path)
        # Automatically update communities after ingestion
        await run_in_threadpool(pipeline.run_community_detection)
        return {"status": "success", "filename": file.filename}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.post("/api/ingest-text", response_model=IngestResponse)
def ingest_text(req: TextIngestRequest):
    """Ingests raw text directly from the dashboard."""
    if not req.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty.")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".txt", mode="w", encoding="utf-8") as tmp:
        tmp.write(f"# {req.title}\n\n{req.content}")
        tmp_path = tmp.name

    try:
        pipeline.ingest_document(tmp_path)
        pipeline.run_community_detection()
        return {"status": "success", "title": req.title}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.post("/api/cluster", response_model=StatusResponse)
def trigger_clustering():
    """Manually re-runs Louvain community detection and summary synthesis."""
    pipeline.run_community_detection()
    return {"status": "success"}

@app.post("/api/clear", response_model=StatusResponse)
def clear_graph():
    """Purges the entire graph database."""
    pipeline.neo4j.clear_database()
    return {"status": "cleared"}

# Serve Frontend static directory (prefers compiled React Vite studio if built, else vanilla web static)
react_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
static_dir = react_dist if os.path.exists(react_dist) else os.path.join(os.path.dirname(__file__), "web", "static")
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
    print("[+] Starting GraphRAG Studio at http://localhost:8000 ...")


