"""
Global Search Engine
Handles dataset-wide thematic queries using Map-Reduce synthesis over hierarchical community summaries.
Features persistent HTTP client pooling, graceful error boundaries, and adaptive community batching.
"""

import json
import logging
import concurrent.futures
from typing import List, Dict, Optional, Tuple, Generator
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
If this community has no relevant information, respond strictly with "NO_RELEVANT_DATA".
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

    def _execute_map_phase(self, client: httpx.Client, query_clean: str) -> Tuple[Optional[str], Optional[str]]:
        """Gathers community summaries and runs parallel map extraction."""
        # 1. Fetch top community summaries ordered by member size
        summaries = self.client.execute_query("""
            MATCH (cs:CommunitySummary)
            RETURN cs.community_id AS id, cs.summary AS summary, cs.member_count AS member_count
            ORDER BY cs.member_count DESC
            LIMIT 10
        """)

        if not summaries:
            return None, "No community summaries available in the knowledge graph. Please run Louvain community clustering first."

        valid_summaries = [s for s in summaries if (s.get("summary") or "").strip()]
        if not valid_summaries:
            return None, "No valid community summaries found to analyze."

        def process_summary(summary_rec):
            comm_id = summary_rec["id"]
            content = summary_rec.get("summary", "").strip()
            point = self._map_community(client, comm_id, content, query_clean)
            if point and "NO_RELEVANT_DATA" not in point:
                return f"### Community {comm_id} Findings:\n{point}"
            return None

        max_workers = min(len(valid_summaries), 5)
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            mapped_results = list(executor.map(process_summary, valid_summaries))

        intermediate_findings = [res for res in mapped_results if res]
        if not intermediate_findings:
            return None, "None of the knowledge communities contain relevant data for this overarching query."

        all_findings = "\n\n".join(intermediate_findings)
        return all_findings, None

    def search(self, query: str) -> str:
        """Executes Map-Reduce global search across community summaries."""
        query_clean = query.strip()
        if not query_clean:
            return "Please enter a valid question."

        with httpx.Client(timeout=120.0) as client:
            all_findings, error = self._execute_map_phase(client, query_clean)
            if error:
                return error

            # Reduce Step: Synthesize into executive response
            return self._reduce_findings(client, all_findings, query_clean)

    def search_stream(self, query: str) -> Generator[str, None, None]:
        """Executes Map-Reduce global search yielding streaming tokens during the synthesis phase."""
        query_clean = query.strip()
        if not query_clean:
            yield "Please enter a valid question."
            return

        with httpx.Client(timeout=120.0) as client:
            all_findings, error = self._execute_map_phase(client, query_clean)
            if error:
                yield error
                return

            yield from self._stream_reduce_findings(client, all_findings, query_clean)

    def _map_community(self, client: httpx.Client, comm_id: int, summary: str, question: str) -> Optional[str]:
        prompt = MAP_PROMPT.format(community_id=comm_id, summary=summary, question=question)
        return self._call_llm(client, prompt)

    def _reduce_findings(self, client: httpx.Client, findings: str, question: str) -> str:
        prompt = REDUCE_PROMPT.format(intermediate_findings=findings, question=question)
        result = self._call_llm(client, prompt)
        return result or "Synthesis generation returned empty response."

    def _stream_reduce_findings(self, client: httpx.Client, findings: str, question: str) -> Generator[str, None, None]:
        prompt = REDUCE_PROMPT.format(intermediate_findings=findings, question=question)
        url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
        payload = {
            "model": settings.llm_model,
            "prompt": prompt,
            "stream": True
        }
        try:
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
            logger.error(f"Global search streaming reduce step failed: {e}")
            yield f"\n\n⚠️ Global search LLM step failed: {e}"

    def _call_llm(self, client: httpx.Client, prompt: str) -> Optional[str]:
        url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
        payload = {
            "model": settings.llm_model,
            "prompt": prompt,
            "stream": False
        }
        try:
            res = client.post(url, json=payload)
            res.raise_for_status()
            return res.json().get("response", "").strip()
        except Exception as e:
            logger.error(f"Global search LLM step failed: {e}")
            return None
