"""
Embedder Module
Generates dense vector embeddings using local Ollama or OpenAI fallback.
"""

from typing import List
import httpx
from config.settings import settings

class Embedder:
    def __init__(self, model: str = None, base_url: str = None):
        self.model = model or settings.embedding_model
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")

    def get_embedding(self, text: str) -> List[float]:
        """Generates embedding for a single text string."""
        url = f"{self.base_url}/api/embeddings"
        payload = {
            "model": self.model,
            "prompt": text
        }
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["embedding"]

    def embed_chunks(self, chunks: list) -> None:
        """Populates the embedding field for each TextChunk in-place."""
        for chunk in chunks:
            if not chunk.embedding:
                chunk.embedding = self.get_embedding(chunk.content)
