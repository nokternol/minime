---
name: minime:capture
description: Capture a new idea, plan, discussion, or solution into Minime. Use when the user wants to record something new.
---

## Setup
Run: `./scripts/minime-capture.sh`

## Instructions
1. Run the script to get context (types, endpoint, required fields)
2. Determine type from user intent: idea (shower thought, observation), plan (structured action), discussion (open question), solution (code/technical fix)
3. Ask for title if not provided; infer type if obvious
4. Write a concise markdown body — no preamble, just the content
5. Generate 3–5 lowercase tags and a one-sentence summary (max 20 words)
6. POST to `/api/capture`:
   ```json
   { "type": "...", "title": "...", "tags": [...], "summary": "...", "body": "..." }
   ```

## Response contract
- One line: `Captured: [title] as [type] (PR #N)`
- No other output unless user asks
