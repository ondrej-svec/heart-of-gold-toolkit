"""
STORY-012: /guide:pipeline — Edit phase (voice check)

Tests verify:
- agents/voice-checker.md exists (dedicated subagent for voice fidelity)
- SKILL.md instructs scanning LinkedIn draft (and blog outline if present) for voice issues
- Checks: jargon blocklist hits, unverifiable claims, sentences over 25 words,
  missing first-person voice, corporate/generic tone
- Voice fit score: base 85 with specific deductions
  - Jargon hit: -10 per term
  - Unverifiable claim: -5
  - Long sentence (>25 words): -5
  - Generic tone: -5
  - No first-person voice: -10
- If score >= 75: content is ready, add score to frontmatter
- If score < 75: rewrite once to fix issues, re-score
- If still < 75 after rewrite: flag needs_human_review: true
- Edit changes logged in pipeline state for transparency
- Edge cases: missing voice reference (basic jargon scan only), score exactly 75 (pass),
  all content flagged (still deliver brief)
"""
import os
import pytest
from conftest import GUIDE_ROOT

SKILL_MD = os.path.join(GUIDE_ROOT, "skills", "pipeline", "SKILL.md")
VOICE_CHECKER_AGENT_MD = os.path.join(GUIDE_ROOT, "agents", "voice-checker.md")


# ---------------------------------------------------------------------------
# File existence
# ---------------------------------------------------------------------------

def test_story_012_voice_checker_agent_exists():
    """STORY-012: agents/voice-checker.md must exist (voice fidelity subagent)."""
    assert os.path.exists(VOICE_CHECKER_AGENT_MD), (
        f"voice-checker.md not found at {VOICE_CHECKER_AGENT_MD}. "
        "Create plugins/guide/agents/voice-checker.md as the voice fidelity subagent."
    )


def test_story_012_voice_checker_agent_has_meaningful_content():
    """STORY-012: agents/voice-checker.md must not be an empty stub."""
    assert os.path.exists(VOICE_CHECKER_AGENT_MD)
    content = open(VOICE_CHECKER_AGENT_MD).read().strip()
    assert len(content) >= 100, (
        f"agents/voice-checker.md is too short ({len(content)} chars) — "
        "it must contain real subagent instructions for voice fidelity checking."
    )


def test_story_012_voice_checker_references_jargon():
    """STORY-012: agents/voice-checker.md must reference jargon detection."""
    assert os.path.exists(VOICE_CHECKER_AGENT_MD)
    content = open(VOICE_CHECKER_AGENT_MD).read().lower()
    assert "jargon" in content or "blocklist" in content, (
        "agents/voice-checker.md must include instructions for jargon detection."
    )


# ---------------------------------------------------------------------------
# What gets checked
# ---------------------------------------------------------------------------

def test_story_012_skill_checks_jargon_blocklist():
    """STORY-012: SKILL.md must instruct scanning for jargon blocklist hits."""
    assert os.path.exists(SKILL_MD), f"SKILL.md not found at {SKILL_MD}"
    content = open(SKILL_MD).read().lower()
    assert "jargon" in content and ("blocklist" in content or "block list" in content), (
        "SKILL.md must instruct checking for jargon blocklist hits in the voice check phase."
    )


def test_story_012_skill_checks_unverifiable_claims():
    """STORY-012: SKILL.md must instruct scanning for unverifiable statistical claims."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        "unverifiable" in content
        or "statistical" in content
        or "claim" in content
    ), (
        "SKILL.md must instruct checking for unverifiable statistical claims."
    )


def test_story_012_skill_checks_sentence_length():
    """STORY-012: SKILL.md must instruct flagging sentences over 25 words."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "25" in content and "word" in content.lower(), (
        "SKILL.md must instruct checking for sentences over 25 words."
    )


def test_story_012_skill_checks_first_person_voice():
    """STORY-012: SKILL.md must instruct checking for first-person voice."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "first-person" in content or "first person" in content, (
        "SKILL.md must instruct verifying the content uses first-person voice."
    )


def test_story_012_skill_checks_corporate_tone():
    """STORY-012: SKILL.md must instruct checking for corporate/generic tone."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert "corporate" in content or "generic" in content, (
        "SKILL.md must instruct checking for corporate or generic tone."
    )


# ---------------------------------------------------------------------------
# Scoring: base and deductions
# ---------------------------------------------------------------------------

def test_story_012_voice_score_base_is_85():
    """STORY-012: Voice fit score must start at a base of 85."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "85" in content, (
        "SKILL.md must specify a base voice fit score of 85."
    )


def test_story_012_jargon_deduction_is_10():
    """STORY-012: Jargon hit must deduct 10 points from the voice score."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    # Look for -10 in the context of jargon
    assert "-10" in content and "jargon" in content.lower(), (
        "SKILL.md must specify a -10 deduction per jargon blocklist hit."
    )


def test_story_012_unverifiable_claim_deduction_is_5():
    """STORY-012: Unverifiable claim must deduct 5 points from the voice score."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "-5" in content and (
        "claim" in content.lower() or "unverifiable" in content.lower()
    ), (
        "SKILL.md must specify a -5 deduction per unverifiable statistical claim."
    )


def test_story_012_long_sentence_deduction_is_5():
    """STORY-012: Sentences over 25 words must deduct 5 points from the voice score."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "-5" in content and "sentence" in content.lower(), (
        "SKILL.md must specify a -5 deduction for long sentences (over 25 words)."
    )


def test_story_012_generic_tone_deduction_is_5():
    """STORY-012: Generic/corporate tone must deduct 5 points from the voice score."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "-5" in content and (
        "generic" in content.lower() or "corporate" in content.lower()
    ), (
        "SKILL.md must specify a -5 deduction for generic/corporate tone."
    )


def test_story_012_no_first_person_deduction_is_10():
    """STORY-012: Missing first-person voice must deduct 10 points from the voice score."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "-10" in content and (
        "first-person" in content.lower() or "first person" in content.lower()
    ), (
        "SKILL.md must specify a -10 deduction for missing first-person voice."
    )


# ---------------------------------------------------------------------------
# Threshold and rewrite logic
# ---------------------------------------------------------------------------

def test_story_012_score_threshold_is_75():
    """STORY-012: Voice score threshold for passing is 75."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "75" in content, (
        "SKILL.md must specify 75 as the voice score threshold."
    )


def test_story_012_passing_score_adds_to_frontmatter():
    """STORY-012: When score >= 75, content is ready and score is added to frontmatter."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        ("score" in content and "frontmatter" in content)
        or "voice_score" in content
    ) and (">= 75" in content or "75" in content), (
        "SKILL.md must instruct adding the voice score to frontmatter when score >= 75."
    )


def test_story_012_failing_score_triggers_rewrite():
    """STORY-012: When score < 75, SKILL.md must instruct rewriting once to fix issues."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        "rewrite" in content
        or "re-score" in content
        or "rescore" in content
    ) and ("< 75" in content or "below" in content), (
        "SKILL.md must instruct rewriting the content once to fix voice issues "
        "when score falls below 75."
    )


def test_story_012_still_failing_after_rewrite_flags_human_review():
    """STORY-012: If still < 75 after rewrite, SKILL.md must flag needs_human_review: true."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert "needs_human_review" in content, (
        "SKILL.md must instruct setting 'needs_human_review: true' in frontmatter "
        "if the content still scores < 75 after the rewrite."
    )


def test_story_012_needs_human_review_value_is_true():
    """STORY-012: needs_human_review must be set to true (not just mentioned)."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    idx = content.find("needs_human_review")
    assert idx != -1
    surrounding = content[idx:idx + 40]
    assert "true" in surrounding.lower(), (
        "SKILL.md must set 'needs_human_review: true' — not just mention the field name."
    )


# ---------------------------------------------------------------------------
# Transparency
# ---------------------------------------------------------------------------

def test_story_012_edit_changes_logged_in_pipeline_state():
    """STORY-012: Edit changes must be logged in pipeline state for transparency."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        "log" in content
        or "transparency" in content
        or "pipeline state" in content
    ) and "edit" in content, (
        "SKILL.md must instruct logging edit changes in the pipeline state for transparency."
    )


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_story_012_handles_missing_voice_reference_with_basic_scan():
    """STORY-012: SKILL.md must handle missing voice reference — do basic jargon scan only."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        "voice reference" in content
        or ("voice" in content and "missing" in content)
        or "no voice" in content
    ) and "jargon" in content, (
        "SKILL.md must handle missing voice reference file — "
        "fall back to basic jargon scan only."
    )


def test_story_012_score_exactly_75_passes():
    """STORY-012: A score of exactly 75 must pass (threshold is < 75, not <= 75)."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read()
    assert (
        "exactly 75" in content.lower()
        or ("75" in content and ("pass" in content.lower() or ">= 75" in content or "≥ 75" in content))
    ), (
        "SKILL.md must clarify that a score of exactly 75 passes "
        "(the threshold is strictly < 75)."
    )


def test_story_012_all_content_flagged_still_delivers_brief():
    """STORY-012: SKILL.md must still deliver the brief even if all content is flagged."""
    assert os.path.exists(SKILL_MD)
    content = open(SKILL_MD).read().lower()
    assert (
        "still deliver" in content
        or ("deliver" in content and "flag" in content)
        or ("brief" in content and "flag" in content and "draft" in content)
    ), (
        "SKILL.md must still deliver the daily brief even when all content is flagged "
        "for human review."
    )
