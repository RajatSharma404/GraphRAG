"""
Local Search Engine
Handles targeted, entity-centric queries via multi-hop graph traversals and grounded chunk citations.
Features optimized Cypher retrieval, clean chunk deduplication, and resilient LLM generation.
"""

import re
import json
import logging
from typing import List, Dict, Any, Set, Optional, Tuple, Generator
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

    def _retrieve_context(self, query: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Identifies candidate entities, traverses 1-2 hop relationships, and gathers chunks."""
        query_clean = query.strip()
        if not query_clean:
            return None, None, "Please provide a valid question."

        # 1. Identify candidate entity names using targeted Cypher search
        words = [w for w in re.findall(r'\b\w{3,}\b', query_clean) if not w.lower() in {'what', 'when', 'where', 'which', 'who', 'whom', 'this', 'that', 'with', 'from', 'have', 'does', 'impact', 'role'}]
        
        find_query = """
            MATCH (e:Entity)
            WHERE toLower($query) CONTAINS toLower(e.name)
               OR ANY(word IN $words WHERE toLower(e.name) CONTAINS toLower(word))
            RETURN e.name AS name, e.type AS type
            LIMIT 15
        """
        candidate_records = self.client.execute_query(find_query, {"query": query_clean, "words": words})
        matched_entities = [r["name"] for r in candidate_records if r.get("name")]

        if not matched_entities:
            return None, None, "No relevant graph entities identified for this question in the current knowledge base. Try rephrasing or ingesting relevant documents."

        # 2a. Fetch 1-to-2 hop relationships around matched entities
        rel_query = """
            MATCH (e:Entity)
            WHERE e.name IN $entity_names
            OPTIONAL MATCH (e)-[r:RELATED_TO]-(neighbor:Entity)
            RETURN 
                e.name AS entity, 
                e.description AS entity_desc,
                r.type AS rel_type, 
                r.description AS rel_desc, 
                neighbor.name AS neighbor
            LIMIT 30
        """
        rel_records = self.client.execute_query(rel_query, {"entity_names": matched_entities})

        # 2b. Fetch distinct chunks directly linked to matched entities
        chunk_query = """
            MATCH (e:Entity)-[:MENTIONED_IN]->(c:Chunk)
            WHERE e.name IN $entity_names
            RETURN DISTINCT c.document_name AS doc, c.page_number AS page, c.content AS content
            LIMIT 5
        """
        chunk_records = self.client.execute_query(chunk_query, {"entity_names": matched_entities})

        # 3. Assemble clean context
        graph_lines: Set[str] = set()
        for rec in rel_records:
            if rec.get("entity"):
                desc = rec.get("entity_desc") or ""
                graph_lines.add(f"- {rec['entity']}: {desc}")
            if rec.get("neighbor") and rec.get("rel_type"):
                rel_desc = rec.get("rel_desc") or ""
                graph_lines.add(f"  * Connected to {rec['neighbor']} via {rec['rel_type']}: {rel_desc}")

        chunk_lines: List[str] = []
        for c in chunk_records:
            doc = c.get("doc", "Document")
            page = c.get("page", 1)
            content = c.get("content", "").strip()
            if content:
                chunk_lines.append(f"[{doc}, p.{page}]: \"{content}\"")

        graph_context = "\n".join(sorted(graph_lines)) or "No direct graph relationships found."
        chunk_context = "\n\n".join(chunk_lines) or "No raw text chunks directly linked."
        return graph_context, chunk_context, None

    def search(self, query: str) -> str:
        """Executes targeted multi-hop search around mentioned entities."""
        graph_context, chunk_context, error = self._retrieve_context(query)
        if error:
            return error
        return self._generate_answer(query.strip(), graph_context, chunk_context)

    def search_stream(self, query: str) -> Generator[str, None, None]:
        """Streams targeted multi-hop search tokens around mentioned entities."""
        graph_context, chunk_context, error = self._retrieve_context(query)
        if error:
            yield error
            return
        yield from self._stream_answer(query.strip(), graph_context, chunk_context)

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
        try:
            with httpx.Client(timeout=120.0) as client:
                res = client.post(url, json=payload)
                res.raise_for_status()
                return res.json().get("response", "").strip() or "No synthesis generated."
        except Exception as e:
            logger.error(f"Local search LLM synthesis failed: {e}")
            return f"⚠️ LLM synthesis failed: {e}. Please ensure Ollama or your LLM service is running."

    def _stream_answer(self, question: str, graph_context: str, chunk_context: str) -> Generator[str, None, None]:
        url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
        prompt = LOCAL_ANSWER_PROMPT.format(
            graph_context=graph_context,
            chunk_context=chunk_context,
            question=question
        )
        payload = {
            "model": settings.llm_model,
            "prompt": prompt,
            "stream": True
        }
        try:
            with httpx.Client(timeout=120.0) as client:
                with client.stream("POST", url, json=payload) as response:
                    response.raise_for_status()
                    for line in response.iter_lines():
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            token = data.get("response", "")
                            if token:
                                yield token
                        except Exception:
                            continue
        except Exception as e:
            logger.error(f"Local search streaming LLM synthesis failed: {e}")
            yield f"\n\n⚠️ LLM synthesis failed: {e}. Please ensure Ollama or your LLM service is running."
