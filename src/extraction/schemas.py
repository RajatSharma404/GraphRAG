"""
Pydantic Schemas for GraphRAG
Enforces strict schema validation on LLM output and document structures.
"""

from typing import List, Optional
from pydantic import BaseModel, Field

class Entity(BaseModel):
    name: str = Field(description="Normalized name of the entity, title-cased or canonical uppercase")
    type: str = Field(description="Entity category: ORGANIZATION, PERSON, TECHNOLOGY, CONCEPT, LOCATION, EVENT, METRIC")
    description: str = Field(description="Comprehensive summary of what this entity is and does within this context")

class Relationship(BaseModel):
    source: str = Field(description="Canonical name of the source entity")
    target: str = Field(description="Canonical name of the target entity")
    relation_type: str = Field(description="UPPERCASE relationship type, e.g., DEVELOPS, INVESTS_IN, PARTNERS_WITH, DEPENDS_ON")
    description: str = Field(description="Detailed narrative explaining the specific interaction or connection")
    weight: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence or significance score between 0.0 and 1.0")

class ExtractedGraph(BaseModel):
    entities: List[Entity] = Field(default_factory=list, description="List of recognized entities in the text")
    relationships: List[Relationship] = Field(default_factory=list, description="List of detected relationships between entities")

class TextChunk(BaseModel):
    chunk_id: str = Field(description="Unique deterministic or UUID identifier for the chunk")
    document_name: str = Field(description="Source file or document name")
    page_number: int = Field(default=1, description="Page index or section number")
    content: str = Field(description="Raw text content of the chunk")
    token_count: int = Field(default=0, description="Approximate token count")
    embedding: Optional[List[float]] = Field(default=None, description="Dense vector embedding")
