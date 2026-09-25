---
name: improvement
description: >-
  Thoroughly audits and reviews codebases, detecting bugs, architectural flaws, security issues, performance bottlenecks, and dead code, while proposing high-impact feature additions with before/after code snippets and prioritized recommendations. Use this skill when the user triggers "/improvement", "review my project", "audit this codebase", "find bugs in my project", "what can I improve in my code", or provides a repo/files for feedback.
---

# Senior Codebase Auditor & Architectural Improvement Skill (`/improvement`)

## Purpose
This skill performs a rigorous, senior-engineer-grade review of any codebase or set of files. It specializes in modern full-stack and data/AI stacks (Next.js 15/16, React 19, TypeScript, Tailwind CSS 4, Node.js, Express 5, Prisma, PostgreSQL, Flask, FastAPI, Python, Neo4j, LLM pipelines), while maintaining high analytical rigor across any language or architecture.

---

## Trigger Conditions
Activate this skill whenever the user:
- Types `/improvement`
- Asks: `"review my project"`, `"audit this codebase"`, `"find bugs in my project"`, `"what can I improve in my code"`
- Shares code files, a GitHub repository link, or pastes project code asking for analysis or enhancements

---

## 5-Step Execution Workflow

### Step 1: Deep Project & Architecture Discovery
Before offering any opinion or critique:
1. Scan project configuration (`package.json`, `requirements.txt`, `pyproject.toml`, `tsconfig.json`, `docker-compose.yml`, `.env.example`).
2. Map architecture: data flow, state management, API layer, database models, background tasks, and error handling patterns.
3. Understand intent: identify what the project solves and what constraints exist.

### Step 2: Multi-Vector Deep Audit
Evaluate the code across 5 distinct dimensions:
1. **Correctness & Reliability**: Logic bugs, unhandled null/undefined, race conditions, connection leaks, unhandled async exceptions, edge cases.
2. **Security & Data Safety**: Injection vulnerabilities (SQL, Cypher, NoSQL), exposed secrets, CORS misconfigurations, missing input validations, unauthenticated endpoints.
3. **Performance & Scalability**: N+1 queries, unindexed lookups, redundant network calls, memory leaks, blocking synchronous operations in async event loops.
4. **Code Quality & Typing**: TypeScript `any` leaks, missing Pydantic validations, dead code, poor naming, duplication, maintainability debt.
5. **Modern Stack Conventions**:
   - Next.js 15/16 & React 19: Server Actions, React Server Components vs. Client Components, proper cache handling (`use cache`, `revalidatePath`), React 19 `use()` hook / action state.
   - Tailwind CSS 4: Modern CSS-first configuration, removal of deprecated utilities, CSS variable theme integration.
   - Express 5 & Node.js: Native async route error propagation, middleware safety, security headers (Helmet).
   - Prisma & PostgreSQL: Index strategies, connection pool sizing, transactional isolation.
   - Python / FastAPI / Flask: Async concurrency, Pydantic v2 schemas, connection reuse, dependency injection.

### Step 3: Proactive Feature Engineering & Multi‑Path Planning
For each identified improvement, **brainstorm at least two distinct implementation approaches** (e.g., library substitution vs. custom solution, incremental rollout vs. big‑bang). Then **draft a detailed execution plan** covering:
- **Code changes** (file‑by‑file diff outline)
- **Configuration updates**
- **Testing strategy** (unit, integration, performance)
- **Deployment checklist** (migrations, feature flags)
- **Effort estimate & risk rating**

Key focus areas:
- Developer experience (telemetry, OpenAPI schemas, automated migrations, staging seeds)
- Production resilience (rate‑limiting, circuit breakers, structured JSON logging, health probes)
- User value additions (streaming responses, optimistic UI updates, batch processing, search/filtering).

### Step 4: Generate the Senior Improvement Report
Format the report strictly using this structured schema:

```markdown
# 🚀 Codebase Architecture & Improvement Audit: [Project Name]

## 📋 Executive Summary
[High-level overview of project strengths, architectural posture, and primary risk areas]

## 🚦 Severity Matrix
| Priority | Count | Description |
|---|---|---|
| 🔴 **Critical** | N | Immediate bugs, data loss risks, or security vulnerabilities |
| 🟠 **High** | N | Major architectural flaws, serious performance or scalability bottlenecks |
| 🟡 **Medium** | N | Code health, error resilience, missing edge cases, typing gaps |
| 🟢 **Low** | N | Style consistency, dead code, minor DX or UX optimizations |

---

## 🐛 1. Bug Fixes & Correctness
[For each bug: Severity badge, Root cause explanation, and exact Before vs After code diff]

## ⚠️ 2. Major Architectural & Performance Improvements
[For each major issue: Scalability/Bottleneck analysis and solution with code]

## 🔧 3. Minor Changes & Code Quality
[Typing fixes, error boundary improvements, cleanup]

## ✨ 4. Proactive Feature Additions
[Concrete new capabilities with architecture outline and implementation code]

## 📁 5. File-by-File Breakdown & Line References
[Granular table or listing pointing to exact files and line ranges with targeted action items]
```

### Step 5: Autonomous Skill Self-Update Protocol
Whenever this skill is run on a project:
1. Check if the project introduces a new technology, library, or architectural pattern not currently emphasized in this skill.
2. If new patterns (e.g., GraphQL Yoga, tRPC, Redis BullMQ, LangGraph) are discovered or user preferences are clarified, **automatically update this `SKILL.md`** to add specialized audit rules for that technology under Step 2.
3. Keep the skill evolving continuously with each codebase reviewed.
