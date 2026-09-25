---
name: ragas-benchmark
description: >-
  Executes, analyzes, and extends Ragas-based quantitative evaluation benchmarks (faithfulness, answer relevancy, context precision, latency) for GraphRAG. Use this skill when evaluating retrieval quality, running benchmarks, comparing GraphRAG vs baseline vector RAG, or adding new evaluation test cases.
---

# GraphRAG Ragas Benchmark & Evaluation Skill (`ragas-benchmark`)

## Purpose
Automates execution, metric logging, and regression testing of the GraphRAG pipeline against curated test datasets using the Ragas (Retrieval-Augmented Generation Assessment) framework.

---

## Benchmark Execution Workflow

### 1. Run Automated Suite
Execute the benchmark harness:
```bash
python evaluation/benchmark.py
```

### 2. Metric Verification Targets
- **Faithfulness**: > 0.90 (Measures absence of hallucinations relative to retrieved context)
- **Answer Relevancy**: > 0.90 (Measures relevance of final answer to prompt question)
- **Context Precision**: > 0.90 (Measures ratio of relevant signal vs noise in retrieved subgraph)
- **Composite Score**: Harmonic mean across metrics

### 3. Adding New Test Cases
Append test cases to `evaluation/eval_dataset.json` following this schema:
```json
{
  "id": "tc_06",
  "query": "What is the relationship between Entity A and Entity B?",
  "search_mode": "local",
  "ground_truth": "Expected deterministic factual ground truth."
}
```

---

## Autonomous Skill Self-Update Protocol
When evaluation datasets are updated or new metrics (e.g., Context Recall, Semantic Similarity) are added in `evaluation/evaluator.py`, update this `SKILL.md` to reflect new target thresholds and CLI flags.
