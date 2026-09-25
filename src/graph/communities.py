"""
Community Detection & Summarization Module
Runs Louvain clustering on the graph and uses LLM to synthesize hierarchical community summaries.
Features batched updates, full node inclusion, and HTTP resilience.
"""

import logging
from typing import Dict, List, Any
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
        G = nx.Graph()

        # 1. Add all entities (including singletons)
        all_nodes = self.client.execute_query("MATCH (e:Entity) RETURN e.name AS name")
        for node in all_nodes:
            if node.get("name"):
                G.add_node(node["name"])

        # 2. Add all relationships
        query = """
            MATCH (s:Entity)-[r:RELATED_TO]->(t:Entity)
            RETURN s.name AS source, t.name AS target, r.weight AS weight, r.type AS rel_type
        """
        records = self.client.execute_query(query)
        for rec in records:
            G.add_edge(
                rec["source"], 
                rec["target"], 
                weight=float(rec.get("weight") or 1.0),
                rel_type=rec.get("rel_type", "RELATED_TO")
            )
        return G

    def detect_and_assign_communities(self) -> Dict[int, List[str]]:
        """Executes Louvain algorithm and tags each Entity in Neo4j in a single batched Cypher query."""
        G = self.build_networkx_graph()
        if len(G.nodes) == 0:
            logger.warning("Graph is empty; skipping community detection.")
            return {}

        partition = community_louvain.best_partition(G, weight="weight")
        communities: Dict[int, List[str]] = {}

        # Prepare batched parameter list
        batch: List[Dict[str, Any]] = []
        for node_name, comm_id in partition.items():
            comm_int = int(comm_id)
            communities.setdefault(comm_int, []).append(node_name)
            batch.append({"name": node_name, "comm_id": comm_int})

        # Single batched UNWIND write to Neo4j
        if batch:
            self.client.execute_query("""
                UNWIND $batch AS item
                MATCH (e:Entity {name: item.name})
                SET e.community_id = item.comm_id
            """, {"batch": batch})

        logger.info(f"Detected {len(communities)} communities across {len(G.nodes)} entities (batched write).")
        return communities

    def generate_community_summaries(self, communities: Dict[int, List[str]]) -> None:
        """Iterates over each detected community and writes a synthesis report into Neo4j."""
        with httpx.Client(timeout=120.0) as http_client:
            for comm_id, entity_names in communities.items():
                if len(entity_names) < 2:
                    continue  # Skip isolated singletons for summary generation

                # Fetch relations within this community
                query = """
                    MATCH (s:Entity)-[r:RELATED_TO]->(t:Entity)
                    WHERE s.name IN $names AND t.name IN $names
                    RETURN s.name AS source, s.type AS s_type, r.type AS rel, t.name AS target, r.description AS desc
                """
                relations = self.client.execute_query(query, {"names": entity_names})
                
                if relations:
                    elements_text = "\n".join([
                        f"- ({r['source']} [{r.get('s_type', 'ENTITY')}]) --[{r['rel']}]--> ({r['target']}): {r.get('desc', '')}"
                        for r in relations
                    ])
                else:
                    # Fallback to entity descriptions if edges are between outside clusters
                    nodes_query = """
                        MATCH (e:Entity)
                        WHERE e.name IN $names
                        RETURN e.name AS name, e.type AS type, e.description AS desc
                    """
                    ent_records = self.client.execute_query(nodes_query, {"names": entity_names})
                    elements_text = "\n".join([
                        f"- {e['name']} [{e.get('type', 'ENTITY')}]: {e.get('desc', '')}"
                        for e in ent_records
                    ])

                summary_text = self._call_llm_summary(http_client, elements_text)

                # Ingest CommunitySummary node
                self.client.execute_query("""
                    MERGE (cs:CommunitySummary {community_id: $comm_id})
                    ON CREATE SET 
                        cs.summary = $summary,
                        cs.member_count = $member_count,
                        cs.created_at = datetime(),
                        cs.updated_at = datetime()
                    ON MATCH SET
                        cs.summary = $summary,
                        cs.member_count = $member_count,
                        cs.updated_at = datetime()
                """, {
                    "comm_id": comm_id,
                    "summary": summary_text,
                    "member_count": len(entity_names)
                })

    def _call_llm_summary(self, http_client: httpx.Client, elements_text: str) -> str:
        """Helper to invoke Ollama for summarization using shared HTTP client."""
        url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
        payload = {
            "model": settings.llm_model,
            "prompt": COMMUNITY_SUMMARY_PROMPT.format(elements=elements_text or "No elements provided."),
            "stream": False
        }
        try:
            res = http_client.post(url, json=payload)
            res.raise_for_status()
            return res.json().get("response", "").strip() or "Summary generation completed without content."
        except Exception as e:
            logger.error(f"Failed to generate community summary: {e}")
            return f"Summary generation unavailable ({e})."
