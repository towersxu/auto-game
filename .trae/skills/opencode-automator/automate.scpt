#!/usr/bin/osascript

on run argv
    set taskContent to item 1 of argv
    
    tell application "OpenCode"
        activate
    end tell
    
    delay 1.0
    
    tell application "System Events"
        tell process "OpenCode"
            keystroke "s" using {shift down, command down}
        end tell
    end tell
    
    delay 0.5
    
    tell application "System Events"
        tell process "OpenCode"
            keystroke taskContent
            delay 0.3
            keystroke return
        end tell
    end tell
    
    return "Task submitted successfully: " & taskContent
end run
