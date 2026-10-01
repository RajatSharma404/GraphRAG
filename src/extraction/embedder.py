"""
Embedder Module
Generates dense vector embeddings using local Ollama or OpenAI fallback.
"""

import logging
from typing import List, Optional
import httpx
from config.settings import settings

logger = logging.getLogger("graphrag.embedder")

class Embedder:
    def __init__(self, model: str = None, base_url: str = None):
        self.model = model or settings.embedding_model
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")

    def get_embedding(self, text: str, client: Optional[httpx.Client] = None) -> List[float]:
        """Generates embedding for a single text string with fallback endpoints."""
        url = f"{self.base_url}/api/embeddings"
        payload = {
            "model": self.model,
            "prompt": text
        }
        
        def _do_request(c: httpx.Client) -> List[float]:
            # Try /api/embeddings first
            res = c.post(url, json=payload)
            if res.status_code == 404:
                # Try new Ollama /api/embed endpoint
                alt_url = f"{self.base_url}/api/embed"
                alt_res = c.post(alt_url, json={"model": self.model, "input": text})
                alt_res.raise_for_status()
                data = alt_res.json()
                embeddings = data.get("embeddings") or [data.get("embedding")]
                return embeddings[0]
            res.raise_for_status()
            data = res.json()
            return data.get("embedding", [])

        if client:
            return _do_request(client)
        with httpx.Client(timeout=30.0) as local_client:
            return _do_request(local_client)

    def embed_chunks(self, chunks: list) -> None:
        """Populates the embedding field for each TextChunk in-place using a pooled client."""
        try:
            with httpx.Client(timeout=45.0) as pooled_client:
                for chunk in chunks:
                    if not chunk.embedding:
                        try:
                            chunk.embedding = self.get_embedding(chunk.content, client=pooled_client)
                        except Exception as e:
                            logger.warning(f"Could not compute embedding for chunk {chunk.chunk_id}: {e}")
        except Exception as e:
            logger.warning(f"Embedding service unreachable ({e}). Continuing ingestion without dense vectors.")
