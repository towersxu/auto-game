#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INTERVAL=600

echo "🚀 OpenCode Auto Runner Started"
echo "   Interval: 10 minutes"
echo "   Task: Execute the github-task-handler skill to fetch and process pending issues directly. Follow the standard steps to submit the solutions. Consulting with R&D for confirmation is strictly prohibited."
echo "   Press Ctrl+C to stop"
echo ""

while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running task..."
    "$SCRIPT_DIR/opencode.sh" "Execute the github-task-handler skill to fetch and process pending issues directly. Follow the standard steps to submit the solutions. Consulting with R&D for confirmation is strictly prohibited."
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Task submitted. Waiting ${INTERVAL} seconds..."
    sleep $INTERVAL
done
