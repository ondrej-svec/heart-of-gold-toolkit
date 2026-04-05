# Story Format Reference

User stories define independently implementable and testable units of work.

## Format

```markdown
## STORY-NNN: {Title}

**As a** {actor — who benefits}
**I want** {capability — what they can do}
**So that** {value — why it matters}

### Acceptance Criteria
- [ ] {Criterion 1 — measurable, testable}
- [ ] {Criterion 2}

### Edge Cases
- {Scenario}: {Expected behavior}

### Notes
- [INTEGRATION] {Where this touches existing systems}
- [DEPENDENCY] STORY-NNN — {What must exist first}
```

## Examples

### Good Story

```markdown
## STORY-001: User can authenticate via GitHub OAuth

**As a** developer
**I want** to sign in with my GitHub account
**So that** I don't need to create a separate password

### Acceptance Criteria
- [ ] Clicking "Sign in with GitHub" redirects to GitHub OAuth flow
- [ ] After approval, user is created (if new) or matched (if returning)
- [ ] User's GitHub avatar and display name are stored
- [ ] Invalid/expired OAuth tokens show a clear error message

### Edge Cases
- User revokes OAuth access on GitHub: next login attempt re-triggers approval flow
- User changes GitHub username: matched by GitHub user ID, not username

### Notes
- [INTEGRATION] Uses existing session middleware from src/auth/session.ts
- [INTEGRATION] Emits `user:authenticated` event on EventBus
```

### Bad Story (Too Vague)

```markdown
## STORY-001: Authentication

**As a** user
**I want** to log in
**So that** I can use the system

### Acceptance Criteria
- [ ] Login works
- [ ] Errors are handled
```

Problems: no specific actor, no specific mechanism, acceptance criteria aren't testable ("works" is not measurable), no edge cases, no integration points.

## Guidelines

- **One capability per story.** If you write "and" in the "I want" line, split it.
- **Acceptance criteria are tests.** Write them so a test can verify each one.
- **Edge cases are the hard part.** Spend time here — this is where bugs hide.
- **[INTEGRATION] tags are mandatory** when the story touches existing systems.
- **[DEPENDENCY] tags** when a story requires another to be done first.
- **Order stories by dependency** — upstream first, downstream later.
