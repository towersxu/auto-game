#!/bin/bash

TASK="${1:-This is a test task}"

osascript -e "
tell application \"OpenCode\"
    activate
end tell

delay 2.0

tell application \"System Events\"
    tell process \"OpenCode\"
        set frontmost to true
        delay 0.5
        keystroke \"s\" using {shift down, command down}
        delay 1.5
        keystroke \"$TASK\"
        delay 0.8
        keystroke return
    end tell
end tell
"

echo "✅ Task submitted: $TASK"
