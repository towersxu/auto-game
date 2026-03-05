---
name: "spec-task-decomposer"
description: "Decomposes a requirement issue into GitHub sub-issues and tracks subtask progress. Invoke when user wants to break down a large requirement into manageable subtasks or check subtask progress."
---

# Spec Task Decomposer

This skill implements the Spec Coding workflow by decomposing high-level requirements into trackable GitHub sub-issues and maintaining their development progress.

## Features

- **Requirement Decomposition**: Creates sub-issues from a parent requirement issue
- **Label Management**: Automatically creates and manages `subtask`, `subtask-pending`, `subtask-in-progress`, `subtask-done` labels
- **Progress Tracking**: Maintains local state and updates GitHub with a progress checklist
- **Sequential Processing**: Provides the next pending subtask in order
- **Status Visibility**: Shows a summary of all subtask statuses

## Commands

### decompose
Break a parent issue into subtasks by creating sub-issues.
```bash
node index.js decompose <parent-issue> --tasks '<JSON array>'
```

Subtasks JSON format:
```json
[
  {"title": "Subtask title 1", "body": "Description 1"},
  {"title": "Subtask title 2", "body": "Description 2"}
]
```

Example:
```bash
node index.js decompose 22 --tasks '[{"title":"Setup CI","body":"Configure GitHub Actions workflow"},{"title":"Write unit tests","body":"Add test coverage for all modules"}]'
```

### status
Show progress of all subtasks for a parent issue.
```bash
node index.js status <parent-issue>
```

### next
Get the next pending subtask to work on.
```bash
node index.js next <parent-issue>
```

### start
Mark a subtask as in-progress (adds `subtask-in-progress` label).
```bash
node index.js start <subtask-issue>
```

### complete
Mark a subtask as done and close it.
```bash
node index.js complete <subtask-issue>
```

## Usage

Invoke this skill when:
- User provides a large requirement that needs to be broken into steps
- User wants to check progress of ongoing subtasks
- User wants to get the next task to implement in a multi-step requirement
- User wants to mark a subtask as complete

## Requirements

- Node.js installed
- GitHub Personal Access Token (set as `GITHUB_TOKEN` environment variable)
- Git repository with GitHub remote configured

## Configuration

- `GITHUB_TOKEN`: GitHub Personal Access Token with repo permissions (required)
- `GITHUB_REPOSITORY`: Repository in format `owner/repo`. Auto-detected from git remote.

## Workflow

```
1. decompose <parent>   → Create sub-issues from requirement
2. next <parent>        → Get next pending subtask
3. start <subtask>      → Mark subtask as in-progress
4. [AI Agent implements the subtask]
5. complete <subtask>   → Close subtask, return to step 2
```

## Progress Tracking

Sub-issues are tracked via:
- **GitHub Labels**: `subtask-pending` → `subtask-in-progress` → `subtask-done`
- **Issue State**: Subtask is closed when marked complete
- **Local State**: `.subtask-progress.json` stores parent-subtask relationships
- **Parent Comment**: A checklist comment is added to the parent issue

## Output Format

### Status output
```
📊 Subtask Progress for Issue #22: [task]Pull Request 自动测试
============================================================
⏳ #23 [pending] Setup CI configuration
   https://github.com/owner/repo/issues/23
✅ #24 [done] Write unit tests
   https://github.com/owner/repo/issues/24
🔄 #25 [in-progress] Add integration tests
   https://github.com/owner/repo/issues/25
============================================================
Total: 3 | ✅ Done: 1 | 🔄 In Progress: 1 | ⏳ Pending: 1
```

### Next output
```
📋 Next pending subtask:
   Issue: #23
   Title: Setup CI configuration
   URL: https://github.com/owner/repo/issues/23

💡 Run "node index.js start 23" to begin working on it
```
