#!/bin/bash

TASK="${1:-This is a test task}"

osascript <<EOF
tell application "OpenCode"
    activate
end tell

delay 2.0

tell application "System Events"
    tell process "OpenCode"
        set frontmost to true
        delay 0.5
        keystroke "s" using {shift down, command down}
        delay 1.5
        
        repeat with c in characters of "$TASK"
            if c is "/" then
                key code 41
            else if c is "-" then
                key code 27
            else if c is "." then
                key code 47
            else if c is "_" then
                keystroke "-" using {shift down}
            else
                keystroke c
            end if
            delay 0.05
        end repeat
        
        delay 0.8
        keystroke return
    end tell
end tell
EOF

echo "✅ Task submitted: $TASK"
