---
name: commit
description: >-
  Prepares granular atomic git commits per file with Conventional Commit messages, enforces pre-commit security/secret scanning, provides an interactive dry-run review, and strictly requires explicit user confirmation before executing any git commit or push. Use this skill when the user asks to commit, push, create granular commits, stage files individually, or types "/commit".
---

# Safe Granular Atomic Commit Skill (`/commit`)

## Purpose
Enforces high-density, professional, atomic version control by organizing changes into clean, single-file or single-component commits following Conventional Commits standards (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`). 

---

## 🛡️ Security & Privacy Guardrails (Policy Compliance)
To prevent accidental data exposure, credential leaks, and repository pollution:
1. **Secret & Privacy Scanner**:
   - Pre-scans every modified file before staging.
   - Strictly blocks `.env`, `.pem`, `.key`, credentials, JWTs, AWS/GCP/Ollama/OpenAI secrets, or unauthorized binary files from being staged or committed.
   - Verifies `.gitignore` is properly configured.
2. **Strict User Authorization Gatekeeper (MANDATORY)**:
   - **NEVER** run `git commit` or `git push` autonomously.
   - The agent MUST present a clear Dry-Run Commit Plan and **STOP**.
   - Execution occurs ONLY after the user explicitly types approval (e.g., "Proceed", "Yes", "Commit now", "Push").
3. **Professional Semantic Integrity**:
   - Commits are structured logically per file/module so each commit represents a functional, reviewable milestone rather than arbitrary or empty changes.

---

## Trigger Conditions
Activate this skill whenever the user:
- Types `/commit`
- Says: `"commit my changes"`, `"commit and push"`, `"stage each file individually"`, `"commit each file 1 by 1"`, `"push my code"`

---

## Step-by-Step Execution Workflow

### Step 1: Status Inspection & Diff Analysis
1. Run `git status -s` to inspect all untracked, modified, and deleted files.
2. Run `git diff` to understand exact line-by-line changes across files.
3. Verify that sensitive files (`.env`, `credentials.json`, `node_modules`, `venv`, etc.) are ignored.

### Step 2: Formulate Granular Commit Plan
Organize changes into 1-by-1 file commits with standard Conventional Commit messages:
- Format: `<type>(<scope>): <concise descriptive message>`
- Examples:
  - `feat(api): add health metrics and 3D graph retrieval endpoints`
  - `fix(resolver): normalize entity names and strip corporate suffixes`
  - `refactor(pipeline): streamline async community detection invocation`
  - `docs(readme): update architectural mermaid flow and benchmark scores`

### Step 3: Present Dry-Run Plan & Wait for Explicit Confirmation
Present the proposed sequence to the user in a structured table:

```markdown
### 📋 Proposed Granular Commit & Push Plan

| # | Target File | Action | Proposed Commit Message |
|---|---|---|---|
| 1 | `app.py` | Commit | `feat(api): add error handling and file validation` |
| 2 | `src/pipeline.py` | Commit | `refactor(pipeline): support graceful fallback for missing models` |
| 3 | `README.md` | Commit | `docs(readme): add installation notes and troubleshooting` |

> ⚠️ **Action Required**: Per security and privacy rules, no commits or pushes will be executed until you confirm.
> Please reply **"Confirm"** or specify any modifications to proceed with committing and pushing.
```

**STOP HERE.** Do not execute `git commit` or `git push` until the user provides unambiguous approval.

### Step 4: Staged Execution (Upon User Approval Only)
Once approved:
1. For each file in sequence:
   ```bash
   git add <filepath>
   git commit -m "<message>"
   ```
2. Verify local commit log: `git log -n <count> --oneline`
3. If user approved pushing:
   ```bash
   git push origin <current-branch>
   ```

### Step 5: Autonomous Skill Self-Update Protocol
Whenever this skill is run on a repository:
1. Check the repository's branch naming conventions, Git hooks (`.husky`, `.pre-commit-config.yaml`), or module structure.
2. If new directory scopes or project-specific commit prefix rules are discovered, **update this `SKILL.md`** with the repository's custom scopes and guidelines.
