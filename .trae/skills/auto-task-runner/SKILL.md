---
name: "auto-task-runner"
description: "Automatically polls GitHub for new issues with [task] prefix and manages task queue. Invoke when user wants to check for new tasks or manage pending tasks."
---

# Auto Task Runner

This skill automates the process of continuously polling GitHub for new task issues and managing a task queue.

## Features

- **Continuous Polling**: Automatically checks for new GitHub issues at configurable intervals
- **Task Queue**: Maintains a queue of pending tasks for processing
- **Task Isolation**: Each task is processed in its own branch
- **State Management**: Tracks processed issues to avoid duplicate work
- **Admin Filtering**: Only processes issues from repository admins/maintainers

## Commands

### poll
Start continuous polling for new issues.
```bash
node index.js poll --interval 300000  # Check every 5 minutes
```

### fetch
List all pending tasks in the queue.
```bash
node index.js fetch
```

### start
Start working on an issue (creates branch).
```bash
node index.js start 3  # Start working on issue #3
```

### submit
Submit completed work (commits, pushes, creates PR).
```bash
node index.js submit 3  # Submit work for issue #3
```

### status
Show current status.
```bash
node index.js status
```

### reset
Reset the state and task queue.
```bash
node index.js reset
```

## Usage

Invoke this skill when:
- User wants to check for new GitHub issues
- User wants to see pending tasks
- User wants to start or submit a task

## Requirements

- Node.js installed
- GitHub Personal Access Token (set as `GITHUB_TOKEN` environment variable)
- Git repository with GitHub remote configured

## Configuration

- `GITHUB_TOKEN`: GitHub Personal Access Token with repo permissions (required)
- `GITHUB_REPOSITORY`: Repository in format `owner/repo`. Auto-detected from git remote.
- `POLL_INTERVAL`: Polling interval in milliseconds (default: 60000)
- `WORKSPACE_ROOT`: Root directory for git operations (default: current directory)

## Workflow

```
1. poll    → Continuously check for new issues → Add to queue
2. fetch   → View pending tasks
3. start   → Create branch and prepare for implementation
4. [AI Agent implements the task]
5. submit  → Commit, push, create PR
```

## Example Usage

```bash
# Set token
export GITHUB_TOKEN=your_token

# Start polling (every 5 minutes)
node index.js poll --interval 300000

# In another terminal, check pending tasks
node index.js fetch

# Start working on issue #3
node index.js start 3

# After implementing the task, submit
node index.js submit 3
```

## Integration with AI Agent

The workflow is designed to work with AI agents:

1. `poll` runs in background, discovers new issues
2. `fetch` shows what tasks are available
3. AI agent calls `start` to prepare the workspace
4. AI agent implements the task
5. AI agent calls `submit` to create PR

## Output Format

### Poll output
```
🎉 Found 1 new task(s)!

📋 Issue #3: [task]创建GitHub pages
   URL: https://github.com/owner/repo/issues/3
   Description: 要求：创建一个简单的页面...

💡 Run "node index.js fetch" to see all pending tasks
💡 Run "node index.js start <issue>" to start working on a task
```

### Start output
```
🚀 Starting work on Issue #3: [task]创建GitHub pages
Creating branch: task/issue-3-github-pages

✅ Ready to implement!
   Branch: task/issue-3-github-pages

📋 Task Description:
要求：创建一个简单的页面，部署到当前项目的GitHub page

💡 Implement the task, then run "node index.js submit 3"
```

### Submit output
```
📤 Submitting work for Issue #3...
Current branch: task/issue-3-github-pages
Staging all changes...
Committing with message: Complete task for issue #3: [task]创建GitHub pages
Pushing branch task/issue-3-github-pages to origin...
Creating pull request for issue #3...
Pull request created: https://github.com/owner/repo/pull/4
Adding comment to issue #3...

✅ Task submitted successfully!
   Branch: task/issue-3-github-pages
   Pull Request: https://github.com/owner/repo/pull/4
   Issue: https://github.com/owner/repo/issues/3
```
