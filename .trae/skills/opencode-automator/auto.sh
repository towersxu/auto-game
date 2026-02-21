#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INTERVAL=600

echo "🚀 OpenCode Auto Runner Started"
echo "   Interval: 10 minutes"
echo "   Task: exec github-task-handler skill"
echo "   Press Ctrl+C to stop"
echo ""

while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running task..."
    "$SCRIPT_DIR/opencode.sh" "exec github-task-handler skill"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Task submitted. Waiting ${INTERVAL} seconds..."
    sleep $INTERVAL
done
