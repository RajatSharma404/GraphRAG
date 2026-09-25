"""
Information Extraction Engine
Prompts LLM to extract structured entities and directed relationships from text chunks.
Includes robust JSON cleaning, markdown fence stripping, and fallback handling.
"""

import json
import re
import logging
from typing import Optional, Dict, Any
import httpx
from src.extraction.schemas import ExtractedGraph, TextChunk, Entity, Relationship
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

    @staticmethod
    def _clean_json_string(text: str) -> str:
        """Strips markdown code fences and isolates JSON structure."""
        cleaned = text.strip()
        # Remove ```json and ``` fences
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

        # Find first '{' and last '}'
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start:end + 1]

        return cleaned

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
                raw_json = result.get("message", {}).get("content", "")
                
                cleaned_json = self._clean_json_string(raw_json)
                parsed = json.loads(cleaned_json)

                # Ensure structure matches expected schema
                if not isinstance(parsed, dict):
                    parsed = {}

                entities_raw = parsed.get("entities", [])
                relationships_raw = parsed.get("relationships", [])

                valid_entities = []
                for e in entities_raw:
                    if isinstance(e, dict) and e.get("name"):
                        valid_entities.append(Entity(
                            name=str(e.get("name")),
                            type=str(e.get("type") or "CONCEPT"),
                            description=str(e.get("description") or "")
                        ))

                valid_relationships = []
                for r in relationships_raw:
                    if isinstance(r, dict) and r.get("source") and r.get("target"):
                        try:
                            weight_val = float(r.get("weight", 1.0))
                            weight_val = max(0.0, min(1.0, weight_val))
                        except (TypeError, ValueError):
                            weight_val = 1.0

                        valid_relationships.append(Relationship(
                            source=str(r.get("source")),
                            target=str(r.get("target")),
                            relation_type=str(r.get("relation_type") or "RELATED_TO"),
                            description=str(r.get("description") or ""),
                            weight=weight_val
                        ))

                return ExtractedGraph(entities=valid_entities, relationships=valid_relationships)
        except Exception as e:
            logger.error(f"Extraction failed for chunk {chunk.chunk_id}: {e}")
            return ExtractedGraph()
