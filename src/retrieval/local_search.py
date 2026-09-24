"""
Local Search Engine
Handles targeted, entity-centric queries via multi-hop graph traversals and grounded chunk citations.
"""

import logging
from typing import List, Dict, Any
import httpx
from src.graph.neo4j_client import Neo4jClient
from config.settings import settings

logger = logging.getLogger("graphrag.local_search")

LOCAL_ANSWER_PROMPT = """You are a knowledge retrieval assistant. 
Answer the user question using ONLY the provided knowledge graph entities, relationships, and source document excerpts.
Do not assume or extrapolate beyond this provided context.

Context:
---
[Graph Entities & Relationships]:
{graph_context}

[Source Document Excerpts]:
{chunk_context}
---

Question: {question}

Provide an accurate, detailed answer. Reference specific entities, connections, and document names where applicable.
"""

class LocalSearchEngine:
    def __init__(self, client: Neo4jClient):
        self.client = client

    def search(self, query: str) -> str:
        """Executes targeted multi-hop search around mentioned entities."""
        # 1. Identify candidate entity names in query
        all_entities = [r["name"] for r in self.client.execute_query("MATCH (e:Entity) RETURN e.name AS name")]
        query_lower = query.lower()
        matched_entities = [e for e in all_entities if e.lower() in query_lower]

        if not matched_entities:
            # Fallback: substring matching
            matched_entities = [e for e in all_entities if any(word in e.lower() for word in query_lower.split() if len(word) > 3)]

        if not matched_entities:
            return "No relevant graph entities identified for this question in the current knowledge base."

        # 2. Traverse 1-to-2 hops in the graph around matched entities
        traversal_query = """
            MATCH (e:Entity)
            WHERE e.name IN $entity_names
            OPTIONAL MATCH (e)-[r:RELATED_TO]-(neighbor:Entity)
            OPTIONAL MATCH (e)-[:MENTIONED_IN]->(c:Chunk)
            RETURN 
                e.name AS entity, 
                e.description AS entity_desc,
                r.type AS rel_type, 
                r.description AS rel_desc, 
                neighbor.name AS neighbor,
                collect(DISTINCT c.content)[0..3] AS chunks
        """
        records = self.client.execute_query(traversal_query, {"entity_names": matched_entities})

        # 3. Assemble context
        graph_lines = set()
        chunk_lines = set()

        for rec in records:
            graph_lines.add(f"- {rec['entity']}: {rec['entity_desc']}")
            if rec.get("neighbor"):
                graph_lines.add(f"  * Connected to {rec['neighbor']} via {rec.get('rel_type')}: {rec.get('rel_desc')}")
            for chunk_text in rec.get("chunks", []):
                chunk_lines.add(f"- \"{chunk_text}\"")

        graph_context = "\n".join(graph_lines) or "None found."
        chunk_context = "\n".join(chunk_lines) or "No raw text chunks directly linked."

        # 4. LLM Synthesis
        return self._generate_answer(query, graph_context, chunk_context)

    def _generate_answer(self, question: str, graph_context: str, chunk_context: str) -> str:
        url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
        prompt = LOCAL_ANSWER_PROMPT.format(
            graph_context=graph_context,
            chunk_context=chunk_context,
            question=question
        )
        payload = {
            "model": settings.llm_model,
            "prompt": prompt,
            "stream": False
        }
        with httpx.Client(timeout=120.0) as client:
            res = client.post(url, json=payload)
            res.raise_for_status()
            return res.json().get("response", "")
