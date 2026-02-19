---
name: "auto-task-runner"
description: "Automatically polls GitHub for new issues with [task] prefix and processes them as isolated tasks. Invoke when user wants continuous automated task processing from GitHub issues."
---

# Auto Task Runner

This skill automates the process of continuously polling GitHub for new task issues and processing them with task isolation.

## Features

- **Continuous Polling**: Automatically checks for new GitHub issues at configurable intervals
- **Task Isolation**: Each task is processed in its own branch to prevent conflicts
- **State Management**: Tracks processed issues to avoid duplicate work
- **Admin Filtering**: Only processes issues from repository admins/maintainers
- **[task] Prefix Detection**: Filters issues by the `[task]` prefix in titles

## Commands

### poll
Start continuous polling for new issues.
```bash
node index.js poll
node index.js poll --interval 30000  # Check every 30 seconds
```

### once
Check for new issues once and process them.
```bash
node index.js once
```

### status
Show current status and processed issues.
```bash
node index.js status
```

### reset
Reset the processed issues state.
```bash
node index.js reset
```

## Usage

Invoke this skill when:
- User wants continuous automated task processing
- User asks to monitor GitHub for new tasks
- User wants to set up automated development workflow

## Requirements

- Node.js installed
- GitHub Personal Access Token (set as `GITHUB_TOKEN` environment variable)
- Git repository with GitHub remote configured

## Configuration

The script uses the following environment variables:
- `GITHUB_TOKEN`: GitHub Personal Access Token with repo permissions (required)
- `GITHUB_REPOSITORY`: Repository in format `owner/repo`. Auto-detected from git remote if not set.
- `POLL_INTERVAL`: Polling interval in milliseconds (default: 60000)
- `WORKSPACE_ROOT`: Root directory for git operations (default: current directory)

## Workflow

1. **Poll**: Continuously checks for new issues at the configured interval
2. **Filter**: Only processes issues from admins with `[task]` prefix
3. **Isolate**: Creates a new branch for each task (`task/issue-{number}-{title}`)
4. **Track**: Records processed issues to avoid duplicates
5. **Ready**: Prepares the workspace for task implementation

## Task Isolation

To prevent multiple tasks from interfering with each other:
- Each task gets its own feature branch
- The branch is created from the latest `main`/`master`
- Processed issues are tracked in `.processed-issues.json`

## Example Usage

```bash
# Set token
export GITHUB_TOKEN=your_token

# Start continuous polling (checks every minute by default)
node index.js poll

# Check once for new tasks
node index.js once

# Check status
node index.js status
```

## Integration with github-task-handler

This skill works together with `github-task-handler`:
1. `auto-task-runner` detects new issues and prepares branches
2. The AI agent implements the task
3. `github-task-handler` can be used to submit the completed work

## Output Format

When new tasks are found, the script outputs:
```
🎉 Found N new task(s)!
============================================================
Processing Issue #X: [task] Task Title
============================================================
Creating branch: task/issue-X-task-title

📋 Task Description:
Task description here...

⏳ Waiting for task implementation...
```
