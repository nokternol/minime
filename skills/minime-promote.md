---
name: minime:promote
description: Promote an idea into a plan. Use when an idea has been validated and needs structured follow-through.
---

## Instructions
1. Load the source idea: `GET /api/content/:id`
2. Draft a plan document from the idea body — add sections: Goal, Steps, Success criteria
3. Capture as a plan via `POST /api/capture`:
   ```json
   { "type": "plan", "title": "...", "promoted_from": ["<idea-id>"], "tags": [...], "summary": "...", "body": "..." }
   ```
4. The idea's status will update to `promoted` on the next PR merge via webhook

## Response contract
- One line: `Promoted: [idea title] → [plan title] (PR #N)`
