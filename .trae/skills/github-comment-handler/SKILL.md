# GitHub Comment Handler

**Description:** Handle GitHub comments with [task] prefix from admin users, considering PR and issue context.

## Features

- Fetches comments from issues and pull requests
- Filters comments by admin/maintainer authors
- Filters comments starting with `[task]` (case-insensitive)
- Provides context about the comment location (PR code, issue discussion)
- Can be integrated with task execution systems

## Commands

### fetch
Fetch and list task comments from GitHub.

```bash
node index.js fetch
node index.js fetch --json
```

### process
Process a specific comment as a task.

```bash
node index.js process <comment-id> --issue <issue-number>
node index.js process <comment-id> --pr <pr-number>
```

## Usage

Invoke this skill when:
- User wants to process GitHub comments as tasks
- User asks to handle comments with [task] prefix
- User wants to consider PR/issue context for comment tasks

## Requirements

- Node.js installed
- GitHub Personal Access Token (set as `GITHUB_TOKEN` environment variable)
- Git repository with GitHub remote configured

## Configuration

Environment variables:
- `GITHUB_TOKEN`: GitHub Personal Access Token with repo permissions
- `GITHUB_REPOSITORY`: (Optional) Repository in format `owner/repo`. Auto-detected from git remote if not set.

## Workflow

1. **Fetch**: Detects repository, fetches comments from issues and PRs
2. **Filter**: Filters by admin authors and [task] prefix
3. **Context**: Provides context about where the comment was made
4. **Process**: Can process the comment as a task with full context
