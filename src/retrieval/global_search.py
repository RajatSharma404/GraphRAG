"""
Global Search Engine
Handles dataset-wide thematic queries using Map-Reduce synthesis over hierarchical community summaries.
"""

import logging
from typing import List, Dict
import httpx
from src.graph.neo4j_client import Neo4jClient
from config.settings import settings

logger = logging.getLogger("graphrag.global_search")

MAP_PROMPT = """You are analyzing an individual community summary from a knowledge graph.
Community ID: {community_id}
Summary:
{summary}

Question: {question}

Instructions:
Extract any points directly relevant to answering the question. 
If this community has no relevant information, respond with "NO_RELEVANT_DATA".
Otherwise, provide a concise bullet-point summary of relevant findings from this community.
"""

REDUCE_PROMPT = """You are an executive synthesizer. 
Below are key findings extracted from multiple knowledge graph communities:

{intermediate_findings}

Question: {question}

Synthesize these community findings into a unified, coherent, and comprehensive answer to the question.
Organize with clear headers and bullet points. Avoid redundancy.
"""

class GlobalSearchEngine:
    def __init__(self, client: Neo4jClient):
        self.client = client

    def search(self, query: str) -> str:
        """Executes Map-Reduce global search across community summaries."""
        # 1. Fetch all community summaries
        summaries = self.client.execute_query("""
            MATCH (cs:CommunitySummary)
            RETURN cs.community_id AS id, cs.summary AS summary, cs.member_count AS member_count
            ORDER BY cs.member_count DESC
        """)

        if not summaries:
            return "No community summaries available in the knowledge graph. Run community detection first."

        # 2. Map Step: Extract relevance from each community
        intermediate_findings: List[str] = []
        for s in summaries:
            point = self._map_community(s["id"], s["summary"], query)
            if point and "NO_RELEVANT_DATA" not in point:
                intermediate_findings.append(f"### Community {s['id']} Findings:\n{point}")

        if not intermediate_findings:
            return "None of the knowledge communities contain relevant data for this overarching query."

        # 3. Reduce Step: Synthesize into executive response
        all_findings = "\n\n".join(intermediate_findings)
        return self._reduce_findings(all_findings, query)

    def _map_community(self, comm_id: int, summary: str, question: str) -> str:
        prompt = MAP_PROMPT.format(community_id=comm_id, summary=summary, question=question)
        return self._call_llm(prompt)

    def _reduce_findings(self, findings: str, question: str) -> str:
        prompt = REDUCE_PROMPT.format(intermediate_findings=findings, question=question)
        return self._call_llm(prompt)

    def _call_llm(self, prompt: str) -> str:
        url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
        payload = {
            "model": settings.llm_model,
            "prompt": prompt,
            "stream": False
        }
        with httpx.Client(timeout=120.0) as client:
            res = client.post(url, json=payload)
            res.raise_for_status()
            return res.json().get("response", "")
