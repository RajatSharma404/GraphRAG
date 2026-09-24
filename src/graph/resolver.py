"""
Entity Resolution & Graph Ingestion Module
Normalizes entities, deduplicates aliases, and writes structured nodes and edges into Neo4j.
"""

import re
from typing import List
from src.extraction.schemas import ExtractedGraph, TextChunk, Entity, Relationship
from src.graph.neo4j_client import Neo4jClient

class EntityResolver:
    @staticmethod
    def normalize_name(name: str) -> str:
        """Strips common legal suffixes and cleans casing for entity alignment."""
        cleaned = name.strip()
        # Remove trailing legal suffixes
        cleaned = re.sub(r'(?i)\b(inc|corp|corporation|llc|ltd|co)\b\.?', '', cleaned).strip()
        # Remove extra whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned)
        return cleaned.title() if not cleaned.isupper() else cleaned

class GraphIngester:
    def __init__(self, client: Neo4jClient):
        self.client = client

    def ingest_chunk_and_graph(self, chunk: TextChunk, graph: ExtractedGraph) -> None:
        """Stores raw chunk, creates Entity nodes, creates Relations, and links citations."""
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

            # 2. Ingest Entities & link MENTIONED_IN to Chunk
            for entity in graph.entities:
                norm_name = EntityResolver.normalize_name(entity.name)
                session.run("""
                    MERGE (e:Entity {name: $name})
                    ON CREATE SET 
                        e.type = $type,
                        e.description = $description,
                        e.mentions = 1,
                        e.created_at = datetime()
                    ON MATCH SET 
                        e.mentions = e.mentions + 1,
                        e.description = e.description + " | " + $description
                    
                    WITH e
                    MATCH (c:Chunk {id: $chunk_id})
                    MERGE (e)-[:MENTIONED_IN]->(c)
                """, {
                    "name": norm_name,
                    "type": entity.type.upper(),
                    "description": entity.description,
                    "chunk_id": chunk.chunk_id
                })

            # 3. Ingest Relationships between Entities
            for rel in graph.relationships:
                source_norm = EntityResolver.normalize_name(rel.source)
                target_norm = EntityResolver.normalize_name(rel.target)

                if source_norm == target_norm:
                    continue  # Skip self-referential relations

                session.run("""
                    MATCH (s:Entity {name: $source})
                    MATCH (t:Entity {name: $target})
                    MERGE (s)-[r:RELATED_TO {type: $relation_type}]->(t)
                    ON CREATE SET 
                        r.description = $description,
                        r.weight = $weight,
                        r.created_at = datetime()
                    ON MATCH SET 
                        r.weight = r.weight + $weight,
                        r.description = r.description + " | " + $description
                """, {
                    "source": source_norm,
                    "target": target_norm,
                    "relation_type": rel.relation_type.upper().replace(" ", "_"),
                    "description": rel.description,
                    "weight": rel.weight
                })
