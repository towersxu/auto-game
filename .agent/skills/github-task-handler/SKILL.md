---
name: "github-task-handler"
description: "Fetches GitHub issues from project repo, filters by admin authors and [task] prefix, then executes development tasks locally. Invoke when user wants to process GitHub issues as tasks or automate issue-driven development."
---

# GitHub Task Handler

This skill automates the process of fetching and executing tasks from GitHub issues with full Git workflow integration.

## Features

- Fetches open issues from the current GitHub repository
- Filters issues by:
  - Author must be a repository admin/maintainer
  - Title must start with `[task]` (case-insensitive)
- Creates feature branches for each task
- Commits and pushes changes to GitHub
- Creates Pull Requests automatically
- Adds comments to issues with PR links
- **Label management**: Adds `ai-doing` label when starting a task to prevent duplicate processing
- **Detailed comments**: Posts processing steps and summary comments on completion
- **Failure reporting**: Reports failures with error details to issues

## Commands

### fetch
Fetch and list task issues from GitHub.
```bash
node index.js fetch
node index.js fetch --json
```

### start
Start working on an issue - creates a new branch and adds `ai-doing` label.
```bash
node index.js start <issue-number>
```

If the issue already has `ai-doing` label, the command will fail to prevent duplicate processing.

### submit
Submit completed work - commits, pushes, creates PR, comments on issue, and removes `ai-doing` label.
```bash
node index.js submit <issue-number>
node index.js submit <issue-number> --message "Your commit message"
node index.js submit <issue-number> --steps "Step 1;Step 2;Step 3" --summary "Summary of changes"
```

### fail
Report task failure - adds failure comment and removes `ai-doing` label.
```bash
node index.js fail <issue-number> --error "Error message"
node index.js fail <issue-number> --error "Error message" --steps "Completed step 1;Completed step 2"
```

## Usage

Invoke this skill when:
- User wants to process pending GitHub issue tasks
- User asks to fetch and work on issues from the repository
- User wants automated issue-driven development

## Requirements

- Node.js installed
- GitHub Personal Access Token (set as `GITHUB_TOKEN` environment variable)
- Git repository with GitHub remote configured

## Configuration

The script uses the following environment variables:
- `GITHUB_TOKEN`: GitHub Personal Access Token with repo permissions
- `GITHUB_REPOSITORY`: (Optional) Repository in format `owner/repo`. Auto-detected from git remote if not set.

## Workflow

1. **Fetch**: Detects repository, fetches issues, filters by admin + [task] prefix
2. **Start**: 
   - Checks if issue has `ai-doing` label (fails if present)
   - Adds `ai-doing` label to issue
   - Creates a new branch named `task/issue-{number}-{title}`
3. **Submit**: 
   - Commits all changes
   - Pushes branch to GitHub
   - Creates Pull Request
   - Adds comment to the original issue with PR link
   - Adds detailed comment with steps and summary
   - Removes `ai-doing` label
4. **Fail** (on error):
   - Adds failure comment with error details
   - Removes `ai-doing` label

## Example Workflow

```bash
# Set token
export GITHUB_TOKEN=your_token

# List available tasks
node index.js fetch

# Start working on issue #1
node index.js start 1

# ... make your changes ...

# Submit your work with detailed steps
node index.js submit 1 --message "Implement feature X" --steps "Read code;Modify function;Test changes" --summary "Added new feature X with proper error handling"

# Or report failure if something went wrong
node index.js fail 1 --error "Build failed due to missing dependency" --steps "Read code;Started modification"
```
