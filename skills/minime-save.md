---
name: minime:save
description: Save a session summary back to an in-flight item. Use at the end of a working session to preserve context for next time.
---

## Instructions
1. Identify the current item id from context (was set during minime:continue or minime:capture)
2. Generate a 2–3 sentence session summary: what was decided, what changed, what the next step is
3. POST to `/api/chat/summarise` with the conversation text to get a Gemini-generated summary
4. Update the document's `session_summary` field via `PUT /api/content/:id/session-summary`
   - If that endpoint doesn't exist yet, note it as an open item and output the summary for the user to copy

## Response contract
- One line: `Saved session summary for [title]`
- Show the summary text so the user can verify it
