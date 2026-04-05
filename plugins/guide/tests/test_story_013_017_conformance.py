"""
Architecture Conformance Tests for STORY-013 through STORY-017

These tests verify that the implementation follows the architecture doc —
not just that it works, but that it's built correctly using the specified
dependencies, patterns, and file structure.

Architecture doc: docs/stories/heart-of-gold-toolkit.architecture.md
"""
import os
import re
import pytest
from conftest import REPO_ROOT, GUIDE_ROOT, SCRIPTS_DIR

PIPELINE_SKILL = os.path.join(GUIDE_ROOT, "skills", "pipeline", "SKILL.md")
CAPTURE_SKILL = os.path.join(GUIDE_ROOT, "skills", "capture", "SKILL.md")
WRITE_POST_SKILL = os.path.join(GUIDE_ROOT, "skills", "write-post", "SKILL.md")
NOTIFY_SCRIPT = os.path.join(SCRIPTS_DIR, "notify.sh")
TOP_README = os.path.join(REPO_ROOT, "README.md")
GUIDE_README = os.path.join(GUIDE_ROOT, "README.md")
MARKETPLACE_JSON = os.path.join(REPO_ROOT, ".claude-plugin", "marketplace.json")
GUIDE_PLUGIN_JSON = os.path.join(GUIDE_ROOT, ".claude-plugin", "plugin.json")
DEFAULTS_CONFIG = os.path.join(GUIDE_ROOT, "defaults", "config.yaml")

PLIST_CANDIDATES = [
    os.path.join(GUIDE_ROOT, "scripts", "com.heart-of-gold.pipeline.plist"),
    os.path.join(GUIDE_ROOT, "scripts", "heart-of-gold-pipeline.plist"),
    os.path.join(GUIDE_ROOT, "schedule", "com.heart-of-gold.pipeline.plist"),
    os.path.join(GUIDE_ROOT, "launchd", "com.heart-of-gold.pipeline.plist"),
    os.path.join(REPO_ROOT, "com.heart-of-gold.pipeline.plist"),
]


def _find_plist():
    for path in PLIST_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


def _extract_deliver_section(content):
    m = re.search(
        r'(?:^|\n)#{1,3}\s*(?:Phase\s*5|Step\s*5|Deliver)[^\n]*\n(.*)',
        content, re.DOTALL | re.IGNORECASE,
    )
    if not m:
        return None
    section = m.group(1)
    end = re.search(r'\n## ', section)
    if end:
        section = section[:end.start()]
    return section


# ===========================================================================
# STORY-013 Conformance: notify.sh uses architecture-specified dependencies
# ===========================================================================

def test_story_013_conf_notify_uses_osascript():
    """STORY-013: Architecture requires osascript for iMessage delivery."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    assert "osascript" in content, (
        "notify.sh must use 'osascript' for iMessage delivery. "
        "Architecture doc lists osascript as the iMessage dependency."
    )


def test_story_013_conf_notify_uses_curl():
    """STORY-013: Architecture requires curl for Slack webhook delivery."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    assert "curl" in content, (
        "notify.sh must use 'curl' for Slack webhook delivery. "
        "Architecture doc lists curl as a dependency."
    )


def test_story_013_conf_notify_uses_jq():
    """STORY-013: Architecture requires jq for JSON processing in shell scripts."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    assert "jq" in content, (
        "notify.sh must use 'jq' for safe JSON construction. "
        "Architecture doc lists jq as a dependency. Raw string "
        "interpolation into JSON is a security risk."
    )


def test_story_013_conf_notify_no_node_deps():
    """STORY-013: Architecture states 'No npm/Node.js dependencies' for guide plugin scripts."""
    assert os.path.exists(NOTIFY_SCRIPT)
    content = open(NOTIFY_SCRIPT).read()
    has_node = re.search(r'\bnode\s|npm\s|npx\s', content)
    assert not has_node, (
        "notify.sh must NOT use Node.js/npm. Architecture doc: "
        "'No npm/Node.js dependencies. Claude IS the runtime.'"
    )


# ===========================================================================
# STORY-013 Conformance: Deliver phase follows hybrid architecture pattern
# ===========================================================================

def test_story_013_conf_deliver_has_git_commit():
    """STORY-013: Deliver phase must include git commit as part of delivery."""
    assert os.path.exists(PIPELINE_SKILL)
    content = open(PIPELINE_SKILL).read()
    section = _extract_deliver_section(content)
    assert section is not None, "Deliver section not found"
    assert re.search(r'git.*commit|commit.*git', section, re.IGNORECASE), (
        "Deliver phase must reference git commit. Architecture pipeline flow "
        "specifies committing output files to the repository."
    )


def test_story_013_conf_deliver_has_git_push():
    """STORY-013: Deliver phase must include git push as part of delivery."""
    assert os.path.exists(PIPELINE_SKILL)
    content = open(PIPELINE_SKILL).read()
    section = _extract_deliver_section(content)
    assert section is not None, "Deliver section not found"
    assert re.search(r'git.*push|push.*origin|push.*github', section, re.IGNORECASE), (
        "Deliver phase must reference git push. Pipeline commits AND pushes "
        "so GitHub links in the notification are valid."
    )


def test_story_013_conf_deliver_builds_github_links():
    """STORY-013: Deliver phase must construct GitHub links for the notification."""
    assert os.path.exists(PIPELINE_SKILL)
    content = open(PIPELINE_SKILL).read()
    section = _extract_deliver_section(content)
    assert section is not None, "Deliver section not found"
    assert re.search(r'github.*link|github.*url|github\.com.*blob', section, re.IGNORECASE), (
        "Deliver phase must build GitHub links to committed files. "
        "The iMessage notification includes clickable links to the brief."
    )


def test_story_013_conf_deliver_uses_reply_mcp_tool():
    """STORY-013: Deliver phase must use iMessage reply MCP tool as primary delivery."""
    assert os.path.exists(PIPELINE_SKILL)
    content = open(PIPELINE_SKILL).read()
    section = _extract_deliver_section(content)
    assert section is not None, "Deliver section not found"
    assert re.search(r'reply.*tool|MCP.*reply|reply.*MCP|imessage.*plugin', section, re.IGNORECASE), (
        "Deliver phase must use the iMessage reply MCP tool as primary delivery method."
    )


def test_story_013_conf_deliver_has_osascript_fallback():
    """STORY-013: Deliver phase must have osascript fallback when MCP tool unavailable."""
    assert os.path.exists(PIPELINE_SKILL)
    content = open(PIPELINE_SKILL).read()
    section = _extract_deliver_section(content)
    assert section is not None, "Deliver section not found"
    assert re.search(r'osascript|fall.?back', section, re.IGNORECASE), (
        "Deliver phase must have osascript fallback for headless/launchd contexts."
    )


# ===========================================================================
# STORY-013 Conformance: iMessage brief format
# ===========================================================================

def test_story_013_conf_imessage_has_the_story():
    """STORY-013: iMessage brief must include THE STORY narrative section."""
    assert os.path.exists(PIPELINE_SKILL)
    content = open(PIPELINE_SKILL).read()
    assert re.search(r'THE STORY', content), (
        "Deliver iMessage format must include 'THE STORY' narrative section. "
        "The brief must be rich content, not just links."
    )


def test_story_013_conf_imessage_has_must_reads():
    """STORY-013: iMessage brief must include MUST-READS section."""
    assert os.path.exists(PIPELINE_SKILL)
    content = open(PIPELINE_SKILL).read()
    assert re.search(r'MUST.?READ', content), (
        "Deliver iMessage format must include 'MUST-READS' section."
    )


def test_story_013_conf_imessage_has_top_angle():
    """STORY-013: iMessage brief must include TOP ANGLE section."""
    assert os.path.exists(PIPELINE_SKILL)
    content = open(PIPELINE_SKILL).read()
    assert "TOP ANGLE" in content, (
        "Deliver iMessage format must include 'TOP ANGLE' section."
    )


def test_story_013_conf_imessage_no_emojis():
    """STORY-013: iMessage brief must specify no emojis (they break osascript)."""
    assert os.path.exists(PIPELINE_SKILL)
    content = open(PIPELINE_SKILL).read()
    section = _extract_deliver_section(content)
    assert section is not None, "Deliver section not found"
    assert re.search(r'(?:no|without|No).*emoji|emoji.*(?:break|avoid)', section, re.IGNORECASE), (
        "Deliver iMessage format must explicitly prohibit emojis."
    )


# ===========================================================================
# STORY-014 Conformance: Capture skill follows architecture patterns
# ===========================================================================

def test_story_014_conf_skill_at_architecture_path():
    """STORY-014: Capture skill must be at skills/capture/SKILL.md per architecture."""
    assert os.path.exists(CAPTURE_SKILL), (
        f"Capture skill not at architecture path: {CAPTURE_SKILL}"
    )


def test_story_014_conf_references_config_yaml():
    """STORY-014: Capture skill must reference content/config.yaml (architecture config pattern)."""
    content = open(CAPTURE_SKILL).read()
    assert re.search(r'config\.yaml|content/config', content), (
        "Capture skill must reference config.yaml. Architecture: "
        "'Single config.yaml per user' as the configuration pattern."
    )


def test_story_014_conf_no_external_packages():
    """STORY-014: Capture skill must not require external packages (Claude IS the runtime)."""
    content = open(CAPTURE_SKILL).read()
    has_external = re.search(r'npm install|pip install|require\(|import .* from ["\']', content)
    assert not has_external, (
        "Capture skill must not require external package installations."
    )


# ===========================================================================
# STORY-015 Conformance: Write-post skill follows architecture patterns
# ===========================================================================

def test_story_015_conf_skill_at_architecture_path():
    """STORY-015: Write-post skill must be at skills/write-post/SKILL.md per architecture."""
    assert os.path.exists(WRITE_POST_SKILL), (
        f"Write-post skill not at architecture path: {WRITE_POST_SKILL}"
    )


def test_story_015_conf_output_matches_project_structure():
    """STORY-015: Output path blog/<slug>/post.md must match architecture user project structure."""
    content = open(WRITE_POST_SKILL).read()
    assert re.search(r'blog/', content), (
        "Write-post must output to blog/ directory matching architecture."
    )


def test_story_015_conf_reads_config_for_voice():
    """STORY-015: Write-post must read voice from config.yaml (architecture config pattern)."""
    content = open(WRITE_POST_SKILL).read()
    assert re.search(r'config.*voice|voice.*config|voice\.reference', content, re.IGNORECASE), (
        "Write-post must read voice profile from config.yaml."
    )


# ===========================================================================
# STORY-016 Conformance: Plist follows launchd conventions
# ===========================================================================

def test_story_016_conf_plist_has_working_directory():
    """STORY-016: Plist must set WorkingDirectory for Claude to find the project."""
    path = _find_plist()
    assert path is not None, "No plist found"
    content = open(path).read()
    assert "WorkingDirectory" in content, (
        "Plist must set WorkingDirectory so Claude can find config.yaml."
    )


def test_story_016_conf_plist_has_env_vars():
    """STORY-016: Plist must set EnvironmentVariables (PATH) for headless execution."""
    path = _find_plist()
    assert path is not None, "No plist found"
    content = open(path).read()
    assert "EnvironmentVariables" in content, (
        "Plist must set EnvironmentVariables. Launchd runs with minimal env."
    )


def test_story_016_conf_plist_sets_path():
    """STORY-016: Plist must include PATH in environment variables."""
    path = _find_plist()
    assert path is not None, "No plist found"
    content = open(path).read()
    assert re.search(r'<key>PATH</key>', content), (
        "Plist must set PATH env var for python3/curl/jq discovery."
    )


def test_story_016_conf_plist_run_at_load_false():
    """STORY-016: Plist should NOT run at load — only on schedule."""
    path = _find_plist()
    assert path is not None, "No plist found"
    content = open(path).read()
    assert re.search(r'RunAtLoad.*false', content, re.DOTALL), (
        "Plist must set RunAtLoad to false — run on schedule only."
    )


def test_story_016_conf_plist_references_pipeline():
    """STORY-016: Plist prompt must reference /guide:pipeline skill."""
    path = _find_plist()
    assert path is not None, "No plist found"
    content = open(path).read()
    assert re.search(r'guide.*pipeline|pipeline', content, re.IGNORECASE), (
        "Plist prompt must reference /guide:pipeline skill."
    )


def test_story_016_conf_plist_mentions_lock_file():
    """STORY-016: Plist prompt must mention lock file for concurrency prevention."""
    path = _find_plist()
    assert path is not None, "No plist found"
    content = open(path).read()
    assert re.search(r'lock', content, re.IGNORECASE), (
        "Plist prompt must mention the lock file mechanism."
    )


# ===========================================================================
# STORY-017 Conformance: Documentation references architecture artifacts
# ===========================================================================

def test_story_017_conf_readme_references_marketplace():
    """STORY-017: Top-level README must reference the marketplace mechanism."""
    assert os.path.exists(TOP_README)
    content = open(TOP_README).read()
    assert re.search(r'marketplace', content, re.IGNORECASE), (
        "Top-level README must reference the marketplace install mechanism."
    )


def test_story_017_conf_guide_references_config_yaml():
    """STORY-017: Guide README must reference config.yaml for configuration."""
    assert os.path.exists(GUIDE_README)
    content = open(GUIDE_README).read()
    assert "config.yaml" in content, (
        "Guide README must reference config.yaml."
    )


def test_story_017_conf_guide_lists_all_scripts():
    """STORY-017: Guide README must list all scripts from architecture file structure."""
    assert os.path.exists(GUIDE_README)
    content = open(GUIDE_README).read()
    scripts = ["fetch-rss", "fetch-gmail", "fetch-hn", "notify"]
    missing = [s for s in scripts if s not in content]
    assert not missing, (
        f"Guide README missing script references: {missing}. "
        "Architecture doc specifies these in the file structure."
    )


def test_story_017_conf_guide_lists_dependencies():
    """STORY-017: Guide README must document the plugin's dependencies."""
    assert os.path.exists(GUIDE_README)
    content = open(GUIDE_README).read()
    deps = ["python", "feedparser", "jq", "curl"]
    found = sum(1 for d in deps if re.search(d, content, re.IGNORECASE))
    assert found >= 3, (
        f"Guide README only mentions {found}/4 deps. "
        "Architecture: Python 3.10+, feedparser, jq, curl."
    )


def test_story_017_conf_marketplace_json_exists():
    """STORY-017: .claude-plugin/marketplace.json must exist per architecture."""
    assert os.path.exists(MARKETPLACE_JSON), (
        f"marketplace.json not found at {MARKETPLACE_JSON}."
    )


def test_story_017_conf_guide_plugin_json_exists():
    """STORY-017: plugins/guide/.claude-plugin/plugin.json must exist per architecture."""
    assert os.path.exists(GUIDE_PLUGIN_JSON), (
        f"plugin.json not found at {GUIDE_PLUGIN_JSON}."
    )


def test_story_017_conf_defaults_config_exists():
    """STORY-017: defaults/config.yaml must exist per architecture."""
    assert os.path.exists(DEFAULTS_CONFIG), (
        f"Default config not found at {DEFAULTS_CONFIG}."
    )


# ===========================================================================
# Cross-story: Pipeline 5-phase pattern conformance
# ===========================================================================

def test_story_013_conf_pipeline_has_five_phases():
    """Architecture: Pipeline skill must have 5+ distinct phases matching the architecture flow."""
    assert os.path.exists(PIPELINE_SKILL)
    content = open(PIPELINE_SKILL).read()
    phase_headings = re.findall(r'^#{1,3}\s*Phase\s*\d', content, re.MULTILINE)
    assert len(phase_headings) >= 5, (
        f"Pipeline SKILL.md has {len(phase_headings)} phase headings. "
        "Architecture: Scout → Analyze → Create → Edit → Deliver (5 phases)."
    )
