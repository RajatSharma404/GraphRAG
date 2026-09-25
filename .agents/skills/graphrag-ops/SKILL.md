---
name: graphrag-ops
description: >-
  Inspects, queries, clears, and optimizes Neo4j graph schemas, Louvain community partitions, and Cypher traversals in the GraphRAG project. Use this skill when working with Neo4j connectivity, Cypher queries, graph schema migrations, node/edge inspection, or community detection triggers.
---

# GraphRAG Knowledge Graph & Neo4j Operations Skill (`graphrag-ops`)

## Purpose
Provides specialized operational procedures for inspecting, diagnosing, manipulating, and maintaining the Neo4j Knowledge Graph, entity resolution, and Louvain community hierarchy.

---

## Capabilities & Workflows

### 1. Connectivity & Graph Metric Checks
Run quick health audits on Neo4j:
- Verify Bolt connection: `bolt://localhost:7687`
- Count nodes, relationships, and community summaries:
```cypher
MATCH (e:Entity) RETURN count(e) AS entities;
MATCH ()-[r:RELATED_TO]->() RETURN count(r) AS relations;
MATCH (cs:CommunitySummary) RETURN count(cs) AS communities;
MATCH (c:Chunk) RETURN count(c) AS chunks;
```

### 2. Schema Constraints & Indexes
Ensure standard uniqueness constraints and full-text indexes exist for rapid sub-graph retrieval:
```cypher
CREATE CONSTRAINT entity_name_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.name IS UNIQUE;
CREATE CONSTRAINT chunk_id_unique IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE;
CREATE INDEX entity_community_idx IF NOT EXISTS FOR (e:Entity) ON (e.community_id);
```

### 3. Louvain Community Hierarchy Audit
Inspect modularity partitions and detected clusters:
```cypher
MATCH (e:Entity)
RETURN coalesce(e.community_id, 0) AS community, count(e) AS members, collect(e.name)[0..5] AS sample_members
ORDER BY members DESC;
```

### 4. Graph Ingestion Diagnostics
Inspect dangling nodes or chunks missing entity links:
```cypher
MATCH (c:Chunk) WHERE NOT (c)<-[:MENTIONED_IN]-(:Entity) RETURN count(c) AS unlinked_chunks;
MATCH (e:Entity) WHERE NOT (e)-[:RELATED_TO]-() RETURN count(e) AS orphan_entities;
```

---

## Autonomous Skill Self-Update Protocol
Whenever new entity types, relationship properties, or Cypher indexes are introduced to `src/graph/` or `src/extraction/schemas.py`, update this `SKILL.md` with the new schema definitions and Cypher queries.
