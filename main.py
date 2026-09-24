"""
GraphRAG CLI Entrypoint
Execute end-to-end ingestion, clustering, querying, and visualization export directly from terminal.
"""

import sys
import json
import argparse
from src.pipeline import GraphRAGPipeline
from rich.console import Console
from rich.panel import Panel

console = Console()

def export_graph_json(pipeline: GraphRAGPipeline, output_path: str = "data/processed/graph.json"):
    nodes_query = "MATCH (e:Entity) RETURN e.name AS id, e.type AS type, e.description AS desc, coalesce(e.community_id, 1) AS group"
    rels_query = "MATCH (s:Entity)-[r:RELATED_TO]->(t:Entity) RETURN s.name AS source, t.name AS target, r.type AS label, r.weight AS weight"
    
    nodes = pipeline.neo4j.execute_query(nodes_query)
    rels = pipeline.neo4j.execute_query(rels_query)
    
    data = {"nodes": nodes, "links": rels}
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    console.print(f"[bold green]Exported {len(nodes)} entities and {len(rels)} relationships to {output_path}![/bold green]")
    console.print("Open [bold cyan]data/visualizer.html[/bold cyan] in your web browser to view the 3D graph!")

def main():
    parser = argparse.ArgumentParser(description="Custom Hybrid GraphRAG CLI Engine")
    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # Command: check
    subparsers.add_parser("check", help="Verify Neo4j and Ollama connectivity")

    # Command: ingest
    ingest_parser = subparsers.add_parser("ingest", help="Ingest a document into the Knowledge Graph")
    ingest_parser.add_argument("file", help="Path to PDF or TXT file")

    # Command: cluster
    subparsers.add_parser("cluster", help="Run community detection and generate executive summaries")

    # Command: export
    subparsers.add_parser("export", help="Export the current Neo4j graph to data/processed/graph.json for 3D visualization")

    # Command: query
    query_parser = subparsers.add_parser("query", help="Query the GraphRAG knowledge base")
    query_parser.add_argument("prompt", help="Question to ask")
    query_parser.add_argument("--mode", choices=["local", "global"], default="local", help="Search mode")

    args = parser.parse_args()

    pipeline = GraphRAGPipeline()

    if args.command == "check":
        pipeline.check_health()
    elif args.command == "ingest":
        pipeline.ingest_document(args.file)
    elif args.command == "cluster":
        pipeline.run_community_detection()
    elif args.command == "export":
        export_graph_json(pipeline)
    elif args.command == "query":
        answer = pipeline.ask(args.prompt, mode=args.mode)
        console.print(Panel(answer, title=f"GraphRAG Response ({args.mode.upper()} SEARCH)", border_style="green"))
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
