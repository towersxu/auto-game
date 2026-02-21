---
name: "dev-task-logger"
description: "Records all agent development tasks to a local log file. Invoke when user wants to log a completed task or view task history."
---

# Dev Task Logger

This skill records all development tasks completed by the agent to a local log file for tracking and history purposes.

## Features

- Logs task details with timestamp
- Records task description, files modified, and status
- Provides task history viewing capability
- Supports filtering and searching past tasks

## Usage

Invoke this skill when:
- User wants to log a completed development task
- User wants to view task history
- User wants to track agent development activities

## Log File Location

Tasks are logged to: `.trae/logs/dev-tasks.json`

## Log Entry Format

Each log entry contains:
- `id`: Unique identifier
- `timestamp`: ISO 8601 timestamp
- `title`: Task title/description
- `description`: Detailed task description
- `files`: List of files modified/created
- `status`: Task status (completed/failed)
- `source`: Source of task (github_issue/manual)

## Commands

- `log`: Log a new task entry
- `list`: List all logged tasks
- `search`: Search tasks by keyword
