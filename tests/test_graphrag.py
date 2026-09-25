"""
Unit Test Suite for Custom GraphRAG Engine
Validates chunking, schema serialization, entity resolution, and configuration.
"""

import pytest
from src.extraction.schemas import Entity, Relationship, ExtractedGraph, TextChunk
from src.ingestion.chunker import DocumentChunker
from src.graph.resolver import EntityResolver
from config.settings import settings

def test_settings_loaded():
    assert settings.neo4j_uri is not None
    assert settings.chunk_size > 0

def test_chunker_deterministic_split():
    chunker = DocumentChunker(chunk_size=10, chunk_overlap=2)
    sample_text = "Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8 Word9 Word10 Word11 Word12 Word13 Word14 Word15"
    chunks = chunker.split_text(sample_text, doc_name="test.txt", page_number=1)
    
    assert len(chunks) >= 2
    assert chunks[0].chunk_id != chunks[1].chunk_id
    assert len(chunks[0].chunk_id) == 16
    assert chunks[0].token_count <= 10

def test_entity_resolver_normalization():
    assert EntityResolver.normalize_name("Apple Inc.") == "Apple"
    assert EntityResolver.normalize_name("Microsoft Corporation") == "Microsoft"
    assert EntityResolver.normalize_name("Tesla LLC") == "Tesla"
    assert EntityResolver.normalize_name("   nvidia corp.  ") == "Nvidia"
    assert EntityResolver.normalize_name("ASML") == "ASML"

def test_extracted_graph_schema_validation():
    entity = Entity(name="Nvidia", type="ORGANIZATION", description="GPU manufacturer")
    rel = Relationship(source="Nvidia", target="TSMC", relation_type="CUSTOMERS_OF", description="Purchases wafers", weight=0.95)
    graph = ExtractedGraph(entities=[entity], relationships=[rel])

    assert len(graph.entities) == 1
    assert len(graph.relationships) == 1
    assert graph.relationships[0].weight == 0.95

def test_local_search_empty_query_stream():
    from src.retrieval.local_search import LocalSearchEngine
    class DummyNeo4j:
        def execute_query(self, q, p=None):
            return []
    engine = LocalSearchEngine(DummyNeo4j())
    tokens = list(engine.search_stream(""))
    assert len(tokens) == 1
    assert "valid question" in tokens[0]

