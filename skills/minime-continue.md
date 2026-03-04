---
name: minime:continue
description: Resume work on an existing item in Minime. Use when the user wants to pick up where they left off on an idea, plan, or discussion.
---

## Setup
Run: `./scripts/minime-continue.sh "<title-or-id>"`

## Instructions
1. Run the script with the user's query to get the context packet
2. If multiple matches: present the top 3 and ask which one
3. If one clear match: load it with `GET /api/content/:id` to get the full body
4. Resume from `session_summary` if present, otherwise read the body
5. Continue the conversation naturally — don't re-summarise what the user already knows

## Response contract
- Lead with the current state, not a recap
- Max 5 bullets unless user asks to expand
- At end of session, tell the user to run `/minime:save` to persist the summary
