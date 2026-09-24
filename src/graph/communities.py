"""
Community Detection & Summarization Module
Runs Louvain clustering on the graph and uses LLM to synthesize hierarchical community summaries.
"""

import logging
from typing import Dict, List
import networkx as nx
import community as community_louvain
import httpx
from src.graph.neo4j_client import Neo4jClient
from config.settings import settings

logger = logging.getLogger("graphrag.communities")

COMMUNITY_SUMMARY_PROMPT = """You are a senior intelligence analyst.
You are given a cluster of interconnected entities and their relationships extracted from enterprise documents.

Your objective is to provide a comprehensive, executive-level summary of this community.
Structure your analysis with:
1. Community Title (3-6 words characterizing the main subject)
2. Overarching Narrative / Central Theme
3. Key Entities and their specific roles
4. Critical Interactions, dependencies, or risks identified

Input Graph Elements:
{elements}

Output a clean, authoritative executive report without unnecessary filler.
"""

class CommunityDetector:
    def __init__(self, client: Neo4jClient):
        self.client = client

    def build_networkx_graph(self) -> nx.Graph:
        """Extracts current entities and relationships from Neo4j into an in-memory NetworkX graph."""
        query = """
            MATCH (s:Entity)-[r:RELATED_TO]->(t:Entity)
            RETURN s.name AS source, t.name AS target, r.weight AS weight, r.type AS rel_type
        """
        records = self.client.execute_query(query)
        G = nx.Graph()

        for rec in records:
            G.add_edge(
                rec["source"], 
                rec["target"], 
                weight=rec.get("weight", 1.0),
                rel_type=rec.get("rel_type", "RELATED_TO")
            )
        return G

    def detect_and_assign_communities(self) -> Dict[int, List[str]]:
        """Executes Louvain algorithm and tags each Entity in Neo4j with its community ID."""
        G = self.build_networkx_graph()
        if len(G.nodes) == 0:
            logger.warning("Graph is empty; skipping community detection.")
            return {}

        partition = community_louvain.best_partition(G, weight="weight")
        communities: Dict[int, List[str]] = {}

        for node_name, comm_id in partition.items():
            communities.setdefault(comm_id, []).append(node_name)
            # Write back to Neo4j
            self.client.execute_query("""
                MATCH (e:Entity {name: $name})
                SET e.community_id = $comm_id
            """, {"name": node_name, "comm_id": comm_id})

        logger.info(f"Detected {len(communities)} communities across {len(G.nodes)} entities.")
        return communities

    def generate_community_summaries(self, communities: Dict[int, List[str]]) -> None:
        """Iterates over each detected community and writes a synthesis report into Neo4j."""
        for comm_id, entity_names in communities.items():
            if len(entity_names) < 2:
                continue  # Skip isolated singletons

            # Fetch context for this community
            query = """
                MATCH (s:Entity)-[r:RELATED_TO]->(t:Entity)
                WHERE s.name IN $names AND t.name IN $names
                RETURN s.name AS source, s.type AS s_type, r.type AS rel, t.name AS target, r.description AS desc
            """
            relations = self.client.execute_query(query, {"names": entity_names})
            
            elements_text = "\n".join([
                f"- ({r['source']} [{r['s_type']}]) --[{r['rel']}]--> ({r['target']}): {r['desc']}"
                for r in relations
            ])

            summary_text = self._call_llm_summary(elements_text)

            # Ingest CommunitySummary node
            self.client.execute_query("""
                MERGE (cs:CommunitySummary {community_id: $comm_id})
                SET 
                    cs.summary = $summary,
                    cs.member_count = $member_count,
                    cs.updated_at = datetime()
            """, {
                "comm_id": comm_id,
                "summary": summary_text,
                "member_count": len(entity_names)
            })

    def _call_llm_summary(self, elements_text: str) -> str:
        """Helper to invoke Ollama for summarization."""
        url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
        payload = {
            "model": settings.llm_model,
            "prompt": COMMUNITY_SUMMARY_PROMPT.format(elements=elements_text),
            "stream": False
        }
        try:
            with httpx.Client(timeout=120.0) as client:
                res = client.post(url, json=payload)
                res.raise_for_status()
                return res.json().get("response", "")
        except Exception as e:
            logger.error(f"Failed to generate community summary: {e}")
            return "Summary generation unavailable."
