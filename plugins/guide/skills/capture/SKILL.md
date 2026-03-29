# /guide:capture — Daily Thought Capture

> Capture what's on your mind — morning intentions or evening reflections.

A standalone skill for recording the user's thoughts, ideas, and reflections. Works independently — no pipeline dependency required.

## How It Works

This skill captures the user's raw thoughts through gentle conversation, preserving the verbatim transcript alongside structured themes and connections.

### AM vs PM Mode

The skill operates in two modes:

- **AM (morning)** — Focus on intentions, energy, and what's ahead. Ask about plans, priorities, and what's on their mind for the day. Auto-detect if the current time is before noon.
- **PM (evening)** — Focus on reflections, lessons, and what happened. Ask about wins, challenges, and what they learned. Auto-detect if the current time is after noon.

If the user doesn't specify AM or PM, auto-detect based on the current time of day (before noon = AM, after noon = PM).

## Steps

1. **Read config** from `content/config.yaml` for `output.captures_dir` (fall back to `content/captures/` as default if config is missing)
2. **Greet** the user with a gentle prompt appropriate to the time of day
3. **Listen and explore** — use gentle follow-up prompts to help the user go deeper:
   - "What's behind that?"
   - "How does that connect to what you've been thinking about?"
   - "What would make today feel like a win?"
   - "Is there something you're avoiding?"
4. **Preserve the raw transcript** — keep the user's exact words, don't just summarize
5. **Extract themes** and connections to previous captures or ongoing threads
6. **Save** to `YYYY-MM-DD-am.md` or `YYYY-MM-DD-pm.md` in the captures directory

## Output Format

```markdown
---
date: YYYY-MM-DD
mode: am|pm
themes: [theme1, theme2]
connections: [related captures or thoughts]
---

## Raw Capture

(Verbatim transcript of the conversation)

## Themes

- Theme 1: brief description
- Theme 2: brief description

## Connections

- Links to previous captures or thoughts that relate
```

## iMessage Capture Mode

When running in a `--channels` session with the iMessage plugin, captures can happen entirely via iMessage:

1. A cron-triggered nudge sends a message to the self-chat via the `reply` MCP tool
2. The user replies directly in iMessage with their thoughts
3. Claude reads the reply (via `chat.db` polling), treats it as capture content
4. Claude asks follow-up questions via `reply` tool ("What's behind that?", "Anything else?")
5. When the user signals they're done (e.g., "that's it", "done", or stops replying), Claude saves the capture

**Key differences from terminal mode:**
- Use the `reply` MCP tool for all responses (not `AskUserQuestion`)
- The user's messages arrive as channel notifications, not terminal input
- Keep follow-ups short — iMessage is a phone screen, not a terminal
- Confirm with a brief reply: "Captured. Themes: X, Y. This feeds into tomorrow's brief."
- Find the self-chat `chat_id` by querying: `sqlite3 ~/Library/Messages/chat.db "SELECT guid FROM chat WHERE chat_identifier LIKE '%<phone>%'"`

## Edge Cases

- **Config file missing**: Use default directory `content/captures/`
- **Capture for this period already exists**: Append to the existing file, don't overwrite
- **User doesn't specify AM or PM**: Auto-detect from current time of day (before noon = AM, after noon = PM)
- **Standalone usage**: This skill works without the pipeline having run — no dependency on signals.json or analysis.md
- **iMessage reply with no context**: If a message arrives outside of a capture nudge, treat it as an ad-hoc capture — save it with detected themes
