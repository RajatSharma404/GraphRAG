import uvicorn
"""
GraphRAG Web Application Server
FastAPI backend providing REST endpoints for document ingestion, graph querying, and 3D visualization.
"""

import os
import shutil
import tempfile
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.pipeline import GraphRAGPipeline

app = FastAPI(title="Hybrid GraphRAG Studio", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = GraphRAGPipeline()

class QueryRequest(BaseModel):
    query: str
    mode: str = "local"

class TextIngestRequest(BaseModel):
    title: str
    content: str

@app.get("/api/health")
def get_health():
    """Returns database connectivity and graph metrics."""
    neo_ok = pipeline.neo4j.verify_connectivity()
    if not neo_ok:
        return {"status": "degraded", "neo4j": False, "node_count": 0, "edge_count": 0, "community_count": 0}
    
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

@app.get("/api/graph")
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

@app.post("/api/query")
def execute_query(req: QueryRequest):
    """Executes Local Search or Global Search."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    
    answer = pipeline.ask(req.query, mode=req.mode)
    return {
        "query": req.query,
        "mode": req.mode,
        "answer": answer
    }

@app.post("/api/ingest-file")
async def ingest_file(file: UploadFile = File(...)):
    """Uploads a PDF or text file and ingests it into the knowledge graph."""
    suffix = os.path.splitext(file.filename)[1].lower()
    if suffix not in [".pdf", ".txt", ".md"]:
        raise HTTPException(status_code=400, detail="Only .pdf, .txt, and .md files are supported.")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        pipeline.ingest_document(tmp_path)
        # Automatically update communities after ingestion
        pipeline.run_community_detection()
        return {"status": "success", "filename": file.filename}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.post("/api/ingest-text")
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

@app.post("/api/cluster")
def trigger_clustering():
    """Manually re-runs Louvain community detection and summary synthesis."""
    pipeline.run_community_detection()
    return {"status": "success"}

@app.post("/api/clear")
def clear_graph():
    """Purges the entire graph database."""
    pipeline.neo4j.clear_database()
    return {"status": "cleared"}

# Serve Frontend static directory
static_dir = os.path.join(os.path.dirname(__file__), "web", "static")
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
    print("[+] Starting GraphRAG Studio at http://localhost:8000 ...")


