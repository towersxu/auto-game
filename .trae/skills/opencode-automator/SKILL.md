---
name: "opencode-automator"
description: "Automates OpenCode agent creation by activating the app and sending keyboard shortcuts. Invoke when user wants to automatically create and run OpenCode agents."
---

# OpenCode Automator

This skill automates the process of creating OpenCode agents by simulating keyboard shortcuts.

## Features

- **Auto Activation**: Automatically activates OpenCode application
- **Keyboard Automation**: Simulates ⇧⌘S shortcut to create new agent
- **Task Input**: Types and submits task content automatically
- **Configurable Delays**: Adjustable timing for different system speeds

## Commands

### run
Create a new OpenCode agent with the specified task.
```bash
node index.js run "Fix the bug in authentication module"
```

With custom delay:
```bash
node index.js run "Implement user authentication" --delay 2000
```

### test
Test if OpenCode is installed and accessible.
```bash
node index.js test
```

### help
Show help message.
```bash
node index.js help
```

## Usage

Invoke this skill when:
- User wants to create an OpenCode agent automatically
- User wants to run a task in OpenCode without manual interaction
- User wants to automate OpenCode workflow

## Requirements

- macOS operating system
- OpenCode application installed
- Accessibility permissions granted to terminal/IDE

## Configuration

- `OPENCODE_DELAY`: Default delay between steps in milliseconds (default: 1000)

## Workflow

```
1. Check if OpenCode is running
2. Activate OpenCode window
3. Send keyboard shortcut ⇧⌘S (Shift+Cmd+S)
4. Type task content
5. Press Enter to submit
```

## Accessibility Permissions

For this tool to work, you need to grant Accessibility permissions:

1. Open **System Preferences**
2. Go to **Security & Privacy** > **Privacy**
3. Select **Accessibility**
4. Add your terminal or IDE to the list

## Troubleshooting

### OpenCode not found
Make sure OpenCode is installed in your Applications folder.

### Keyboard shortcuts not working
- Check Accessibility permissions
- Try increasing the delay with `--delay 2000`
- Make sure OpenCode window is not minimized

### Task not submitted
- Check if the shortcut ⇧⌘S is correct for your OpenCode version
- Verify OpenCode has focus when the automation runs

## Example Usage

```bash
# Basic usage
node index.js run "Create a new React component for the dashboard"

# With longer delay for slower systems
node index.js run "Refactor the authentication module" --delay 2000

# Test the setup
node index.js test
```

## Integration with Other Skills

This skill can be combined with other automation skills:

1. Use `github-task-handler` to fetch tasks from GitHub
2. Use `opencode-automator` to submit tasks to OpenCode
3. OpenCode agent processes the task automatically
