"""
Entity Resolution & Graph Ingestion Module
Normalizes entities, deduplicates aliases, prevents description bloat,
and performs batched transactional writes into Neo4j.
"""

import re
from typing import List, Dict, Any
from src.extraction.schemas import ExtractedGraph, TextChunk
from src.graph.neo4j_client import Neo4jClient

class EntityResolver:
    @staticmethod
    def normalize_name(name: str) -> str:
        """Strips common legal suffixes and cleans casing for entity alignment without dropping core names."""
        if not name or not isinstance(name, str):
            return "UNKNOWN"

        cleaned = name.strip()
        # Remove trailing legal suffixes only if name is more than just the suffix
        pattern = r'(?i)\b(inc|corp|corporation|llc|ltd|co)\b\.?$'
        stripped = re.sub(pattern, '', cleaned).strip()
        if stripped:
            cleaned = stripped

        # Collapse whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned)
        if not cleaned:
            return "UNKNOWN"

        # Preserve canonical acronyms like ASML, TSMC, IBM, NVIDIA
        if cleaned.isupper() or len(cleaned) <= 4:
            return cleaned
        return cleaned.title()

class GraphIngester:
    def __init__(self, client: Neo4jClient):
        self.client = client

    def ingest_chunk_and_graph(self, chunk: TextChunk, graph: ExtractedGraph) -> None:
        """Stores raw chunk, creates Entity nodes, creates Relations, and links citations via batched Cypher."""
        driver = self.client.connect()
        with driver.session() as session:
            # 1. Ingest Chunk Node
            session.run("""
                MERGE (c:Chunk {id: $chunk_id})
                ON CREATE SET 
                    c.document_name = $doc_name,
                    c.page_number = $page_number,
                    c.content = $content,
                    c.token_count = $token_count,
                    c.created_at = datetime()
            """, {
                "chunk_id": chunk.chunk_id,
                "doc_name": chunk.document_name,
                "page_number": chunk.page_number,
                "content": chunk.content,
                "token_count": chunk.token_count
            })

            # 2. Prepare Batched Entities
            entity_batch: List[Dict[str, Any]] = []
            for entity in graph.entities:
                norm_name = EntityResolver.normalize_name(entity.name)
                if norm_name == "UNKNOWN":
                    continue
                entity_batch.append({
                    "name": norm_name,
                    "type": (entity.type or "CONCEPT").upper(),
                    "description": (entity.description or "").strip(),
                    "chunk_id": chunk.chunk_id
                })

            if entity_batch:
                session.run("""
                    UNWIND $batch AS item
                    MERGE (e:Entity {name: item.name})
                    ON CREATE SET 
                        e.type = item.type,
                        e.description = item.description,
                        e.mentions = 1,
                        e.created_at = datetime()
                    ON MATCH SET 
                        e.mentions = coalesce(e.mentions, 1) + 1,
                        e.description = CASE 
                            WHEN e.description IS NULL OR e.description = "" THEN item.description
                            WHEN size(item.description) = 0 THEN e.description
                            WHEN e.description CONTAINS item.description THEN e.description
                            WHEN size(e.description) > 1200 THEN e.description
                            ELSE e.description + " | " + item.description
                        END
                    
                    WITH e, item
                    MATCH (c:Chunk {id: item.chunk_id})
                    MERGE (e)-[:MENTIONED_IN]->(c)
                """, {"batch": entity_batch})

            # 3. Prepare Batched Relationships
            rel_batch: List[Dict[str, Any]] = []
            for rel in graph.relationships:
                source_norm = EntityResolver.normalize_name(rel.source)
                target_norm = EntityResolver.normalize_name(rel.target)

                if not source_norm or not target_norm or source_norm == target_norm:
                    continue  # Skip self-referential or invalid relations

                rel_type = (rel.relation_type or "RELATED_TO").upper().replace(" ", "_")
                rel_batch.append({
                    "source": source_norm,
                    "target": target_norm,
                    "relation_type": rel_type,
                    "description": (rel.description or "").strip(),
                    "weight": float(rel.weight) if rel.weight is not None else 1.0
                })

            if rel_batch:
                # Merge entities if missing so relationships are never silently dropped
                session.run("""
                    UNWIND $batch AS item
                    MERGE (s:Entity {name: item.source})
                    ON CREATE SET 
                        s.type = 'CONCEPT', 
                        s.description = 'Extracted relationship endpoint', 
                        s.mentions = 1, 
                        s.created_at = datetime()
                    
                    MERGE (t:Entity {name: item.target})
                    ON CREATE SET 
                        t.type = 'CONCEPT', 
                        t.description = 'Extracted relationship endpoint', 
                        t.mentions = 1, 
                        t.created_at = datetime()

                    MERGE (s)-[r:RELATED_TO {type: item.relation_type}]->(t)
                    ON CREATE SET 
                        r.description = item.description,
                        r.weight = item.weight,
                        r.created_at = datetime()
                    ON MATCH SET 
                        r.weight = coalesce(r.weight, 1.0) + item.weight,
                        r.description = CASE 
                            WHEN r.description IS NULL OR r.description = "" THEN item.description
                            WHEN size(item.description) = 0 THEN r.description
                            WHEN r.description CONTAINS item.description THEN r.description
                            WHEN size(r.description) > 1200 THEN r.description
                            ELSE r.description + " | " + item.description
                        END
                """, {"batch": rel_batch})
