"""
Information Extraction Engine
Prompts LLM to extract structured entities and directed relationships from text chunks.
"""

import json
import logging
from typing import Optional
import httpx
from src.extraction.schemas import ExtractedGraph, TextChunk
from config.settings import settings

logger = logging.getLogger("graphrag.extractor")

EXTRACTION_SYSTEM_PROMPT = """You are a knowledge graph extraction engine.
Extract entities and relationships from the text chunk.

Instructions:
1. "entities": List of salient entities with keys:
   - "name": Canonical entity name (capitalized, unambiguous).
   - "type": Choose from [ORGANIZATION, PERSON, TECHNOLOGY, CONCEPT, LOCATION, EVENT, METRIC].
   - "description": Concise summary of this entity's role in this text.

2. "relationships": List of directed connections with keys:
   - "source": Name of source entity.
   - "target": Name of target entity.
   - "relation_type": Uppercase verb phrase (e.g. SUPPLIES, PARTNERS_WITH, INVESTS_IN, DEPENDS_ON, COMPETES_WITH).
   - "description": Short explanation of their interaction.
   - "weight": Number between 0.0 and 1.0.

Output strictly valid JSON with keys "entities" and "relationships".
"""

class GraphExtractor:
    def __init__(self, model: Optional[str] = None, base_url: Optional[str] = None):
        self.model = model or settings.llm_model
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")

    def extract_from_chunk(self, chunk: TextChunk) -> ExtractedGraph:
        """Invokes LLM with strict JSON formatting to extract graph entities and relationships."""
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": f"Document: {chunk.document_name}\n\nContent:\n{chunk.content}"}
            ],
            "format": "json",
            "stream": False,
            "options": {
                "temperature": 0.0
            }
        }

        try:
            with httpx.Client(timeout=300.0) as client:
                response = client.post(url, json=payload)
                response.raise_for_status()
                result = response.json()
                raw_json = result["message"]["content"]
                parsed = json.loads(raw_json)
                return ExtractedGraph(**parsed)
        except Exception as e:
            logger.error(f"Extraction failed for chunk {chunk.chunk_id}: {e}")
            return ExtractedGraph()
