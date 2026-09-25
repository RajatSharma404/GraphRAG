"""
GraphRAG End-to-End Pipeline Orchestrator
Coordinates document chunking, LLM extraction, graph ingestion, community clustering, and dual-mode retrieval.
"""

import os
import logging
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from config.settings import settings
from src.graph.neo4j_client import Neo4jClient
from src.ingestion.chunker import DocumentChunker
from src.extraction.extractor import GraphExtractor
from src.extraction.embedder import Embedder
from src.graph.resolver import GraphIngester
from src.graph.communities import CommunityDetector
from src.retrieval.local_search import LocalSearchEngine
from src.retrieval.global_search import GlobalSearchEngine

console = Console()
logging.basicConfig(level=logging.INFO)

class GraphRAGPipeline:
    def __init__(self):
        self.neo4j = Neo4jClient()
        self.chunker = DocumentChunker()
        self.extractor = GraphExtractor()
        self.embedder = Embedder()
        self.ingester = GraphIngester(self.neo4j)
        self.community_detector = CommunityDetector(self.neo4j)
        self.local_search = LocalSearchEngine(self.neo4j)
        self.global_search = GlobalSearchEngine(self.neo4j)

    def check_health(self) -> bool:
        """Verifies connection to Neo4j and Ollama."""
        neo_ok = self.neo4j.verify_connectivity()
        console.print(f"[bold cyan]Neo4j Connection:[/bold cyan] {'[green]ONLINE[/green]' if neo_ok else '[red]OFFLINE[/red]'}")
        return neo_ok

    def ingest_document(self, file_path: str) -> None:
        """Full ingestion flow: loads doc -> chunks -> extracts graph -> stores in Neo4j."""
        console.print(Panel(f"Ingesting: [bold yellow]{file_path}[/bold yellow]", title="Pipeline Ingestion"))
        
        # 1. Chunking
        if file_path.endswith(".pdf"):
            chunks = self.chunker.load_pdf(file_path)
        else:
            chunks = self.chunker.load_text(file_path)
            
        console.print(f"Created [bold green]{len(chunks)}[/bold green] text chunks.")

        # 2. Extract & Ingest each chunk
        with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
            task = progress.add_task("[cyan]Extracting graph elements...", total=len(chunks))
            for chunk in chunks:
                extracted = self.extractor.extract_from_chunk(chunk)
                self.ingester.ingest_chunk_and_graph(chunk, extracted)
                progress.advance(task)

        console.print("[bold green]Ingestion complete![/bold green] All entities and relations committed to Neo4j.")

    def run_community_detection(self) -> None:
        """Clusters entities into communities and creates hierarchical summaries."""
        console.print(Panel("Running Louvain Community Detection & Summarization", title="Clustering"))
        communities = self.community_detector.detect_and_assign_communities()
        if communities:
            console.print(f"Generating summaries for [bold cyan]{len(communities)}[/bold cyan] communities...")
            self.community_detector.generate_community_summaries(communities)
            console.print("[bold green]Community summaries stored in Neo4j.[/bold green]")

    def ask(self, query: str, mode: str = "local") -> str:
        """Query entrypoint supporting 'local' (entity-centric) and 'global' (dataset-wide)."""
        console.print(f"\n[bold magenta]Mode: {mode.upper()}[/bold magenta] | Query: [italic]{query}[/italic]\n")
        if mode == "global":
            return self.global_search.search(query)
        else:
            return self.local_search.search(query)

    def ask_stream(self, query: str, mode: str = "local"):
        """Streaming query entrypoint yielding real-time tokens."""
        console.print(f"\n[bold magenta]Mode (STREAM): {mode.upper()}[/bold magenta] | Query: [italic]{query}[/italic]\n")
        if mode == "global":
            yield from self.global_search.search_stream(query)
        else:
            yield from self.local_search.search_stream(query)

