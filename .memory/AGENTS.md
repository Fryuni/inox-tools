# Brain — Agent Memory

This directory contains your project's agent memory, managed by the Brain extension.

## Tools

| Tool            | Purpose                                   |
| --------------- | ----------------------------------------- |
| `memory_commit` | Checkpoint a milestone in understanding   |
| `memory_branch` | Manage branches: create, switch, or merge |

### memory_branch Actions

| Action   | Required Params       | Description                                 |
| -------- | --------------------- | ------------------------------------------- |
| `create` | `name`, `purpose`     | Create a new branch and switch to it        |
| `switch` | `branch`              | Switch active memory branch                 |
| `merge`  | `branch`, `synthesis` | Synthesize a branch's insights into current |

## File Structure

```
.memory/
├── AGENTS.md                    # This file — protocol reference
├── main.md                      # Project roadmap (agent-authored)
└── branches/
    └── <branch-name>/
        ├── commits.md           # Milestone memory snapshots
        ├── log.md               # OTA trace since last commit (auto)
        └── metadata.yaml        # Structured context
```

## Commit Format

Each commit in `commits.md` has three blocks:

- **Branch Purpose** — Why this branch exists
- **Previous Progress Summary** — Rolling compression of all prior commits
- **This Commit's Contribution** — What was just learned or decided

The latest commit always contains a self-contained summary of the full branch history.

## When to Commit

Call `memory_commit` when one of these is true:

- You reached a stable decision or understanding worth preserving.
- You finished an exploration branch with a clear conclusion.
- You are about to change direction significantly.
- You completed meaningful progress and are about to end the session.
- The extension warns that `log.md` is getting large.
- You are about to claim the task is complete or hand off to another agent.

## Conventions

- **Agent-driven**: You decide when to commit, branch, and merge
- **Decisions over details**: Capture "why", not "what" — git tracks file changes
- **Rolling summaries**: Each commit re-synthesizes all prior progress
- **No direct log.md writes**: The extension maintains log.md automatically
- **Status is automatic**: Memory status is injected at session start and appended to tool results (compact/truncated when large; use `read .memory/main.md` for full roadmap)
- **Keep main.md current**: After every commit, re-read `.memory/main.md` in full and rewrite stale sections. Current State should describe what is true _right now_ — remove historical context that belongs in Key Decisions or Milestones. The goal is curation, not accumulation. For trivial commits that don't change project state, pass `update_roadmap: false` to skip the reminder.
