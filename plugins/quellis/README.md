# Quellis — AI Coaching Skills

Open source coaching skills for Claude Code, powered by ICF methodology.

## Getting Started

Install the Heart of Gold toolkit, then enable the Quellis plugin:

```bash
# In your Claude Code settings
/quellis:coach     # Start a coaching conversation
/quellis:reflect   # Guided reflection using FLOW/REVIEW
/quellis:goal-checkin  # Check in on your goals and commitments
```

## Usage

### Coach

Start an ICF-style coaching conversation. Quellis asks powerful questions
rather than giving advice. Works with your existing Claude subscription —
no API key required.

```
/quellis:coach
```

### Reflect

Guided reflection using the FLOW or REVIEW framework. Good for processing
experiences, exploring emotions, and finding patterns.

```
/quellis:reflect
```

### Goal Check-in

Quick accountability check on your active goals. Reviews progress,
explores obstacles, and strengthens commitment.

```
/quellis:goal-checkin
```

## Examples

```
> /quellis:coach
Quellis: What's on your mind today?

> I'm not sure if I should take this new role...
Quellis: What draws you to it — and what makes you hesitate?
```

## Limitations

These skills are stateless — they don't persist memory across sessions.
For persistent coaching with memory, goals, and proactive nudges, see
the Quellis app (Tier 2).

## License

MIT
