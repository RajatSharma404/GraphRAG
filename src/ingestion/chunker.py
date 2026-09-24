"""
Document Ingestion & Chunking Module
Splits unstructured text & PDFs into overlapping semantic chunks with deterministic IDs.
"""

import os
import hashlib
from typing import List
from pypdf import PdfReader
from src.extraction.schemas import TextChunk
from config.settings import settings

class DocumentChunker:
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        self.chunk_size = chunk_size or settings.chunk_size
        self.chunk_overlap = chunk_overlap or settings.chunk_overlap

    def load_pdf(self, file_path: str) -> List[TextChunk]:
        """Reads a PDF file page by page and chunks the text."""
        reader = PdfReader(file_path)
        doc_name = os.path.basename(file_path)
        chunks: List[TextChunk] = []

        for page_idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if not text.strip():
                continue
            page_chunks = self.split_text(text, doc_name=doc_name, page_number=page_idx + 1)
            chunks.extend(page_chunks)

        return chunks

    def load_text(self, file_path: str) -> List[TextChunk]:
        """Reads a plain text or Markdown file and generates chunks."""
        doc_name = os.path.basename(file_path)
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return self.split_text(content, doc_name=doc_name, page_number=1)

    def split_text(self, text: str, doc_name: str, page_number: int = 1) -> List[TextChunk]:
        """Sliding window chunker maintaining word boundaries."""
        words = text.split()
        if not words:
            return []

        chunks: List[TextChunk] = []
        step = max(1, self.chunk_size - self.chunk_overlap)

        for i in range(0, len(words), step):
            chunk_words = words[i:i + self.chunk_size]
            chunk_text = " ".join(chunk_words).strip()
            if not chunk_text:
                continue

            # Deterministic SHA256 chunk ID
            hash_input = f"{doc_name}_{page_number}_{i}_{chunk_text[:50]}"
            chunk_id = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()[:16]

            chunks.append(
                TextChunk(
                    chunk_id=chunk_id,
                    document_name=doc_name,
                    page_number=page_number,
                    content=chunk_text,
                    token_count=len(chunk_words)
                )
            )

            if i + self.chunk_size >= len(words):
                break

        return chunks
