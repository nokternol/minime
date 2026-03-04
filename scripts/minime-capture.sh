#!/usr/bin/env bash
# scripts/minime-capture.sh
# Prints context block for the capture skill prompt

echo "=== MINIME CAPTURE CONTEXT ==="
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "Content types: idea | plan | discussion | solution"
echo "Statuses: draft | active | parked | promoted | done | dismissed"
echo ""
echo "API endpoint: POST /api/capture"
echo "Required fields: type, title, tags[], summary, body"
