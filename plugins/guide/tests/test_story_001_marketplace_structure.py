"""
STORY-001: Create Heart of Gold marketplace repo

Tests verify:
- .claude-plugin/marketplace.json exists and lists all 4 plugins
- Plugin names are valid Claude Code identifiers
- Each plugin has plugin.json with required fields (name, description, version 0.1.0)
- guide plugin has full directory structure
- Stub plugins have plugin.json + README.md only
- Top-level README mentions "Don't Panic" and the install command
"""
import json
import os
import re
import pytest
from conftest import REPO_ROOT


# ---------------------------------------------------------------------------
# marketplace.json
# ---------------------------------------------------------------------------

def test_story_001_marketplace_json_exists():
    """STORY-001: .claude-plugin/marketplace.json must exist at repo root."""
    path = os.path.join(REPO_ROOT, ".claude-plugin", "marketplace.json")
    assert os.path.exists(path), (
        f"marketplace.json not found at {path}. "
        "Create heart-of-gold-toolkit/.claude-plugin/marketplace.json"
    )


def test_story_001_marketplace_json_is_valid_json():
    """STORY-001: marketplace.json must be valid JSON."""
    path = os.path.join(REPO_ROOT, ".claude-plugin", "marketplace.json")
    assert os.path.exists(path), "marketplace.json does not exist"
    with open(path) as f:
        data = json.load(f)  # raises if invalid
    assert isinstance(data, dict), "marketplace.json must be a JSON object"


def test_story_001_marketplace_lists_guide_plugin():
    """STORY-001: marketplace.json must include the 'guide' plugin."""
    path = os.path.join(REPO_ROOT, ".claude-plugin", "marketplace.json")
    assert os.path.exists(path)
    data = json.load(open(path))
    names = {p["name"] for p in data.get("plugins", [])}
    assert "guide" in names, f"'guide' plugin not found in marketplace.json. Found: {names}"


def test_story_001_marketplace_lists_all_four_plugins():
    """STORY-001: marketplace.json must list all 4 plugins: guide, deep-thought, marvin, babel-fish."""
    path = os.path.join(REPO_ROOT, ".claude-plugin", "marketplace.json")
    assert os.path.exists(path)
    data = json.load(open(path))
    names = {p["name"] for p in data.get("plugins", [])}
    expected = {"guide", "deep-thought", "marvin", "babel-fish"}
    missing = expected - names
    assert not missing, f"marketplace.json is missing plugins: {missing}"


def test_story_001_marketplace_plugin_names_are_valid_identifiers():
    """STORY-001: Plugin names must be lowercase and use only letters and hyphens."""
    path = os.path.join(REPO_ROOT, ".claude-plugin", "marketplace.json")
    assert os.path.exists(path)
    data = json.load(open(path))
    for plugin in data.get("plugins", []):
        name = plugin["name"]
        assert name == name.lower(), f"Plugin name '{name}' must be lowercase"
        assert re.match(r'^[a-z][a-z-]*[a-z]$', name), (
            f"Plugin name '{name}' must match [a-z][a-z-]*[a-z] (letters and hyphens only)"
        )


# ---------------------------------------------------------------------------
# Per-plugin plugin.json
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("plugin", ["guide", "deep-thought", "marvin", "babel-fish"])
def test_story_001_each_plugin_has_plugin_json(plugin):
    """STORY-001: Each plugin must have a .claude-plugin/plugin.json."""
    path = os.path.join(REPO_ROOT, "plugins", plugin, ".claude-plugin", "plugin.json")
    assert os.path.exists(path), (
        f"plugin.json missing for '{plugin}' at {path}"
    )


@pytest.mark.parametrize("plugin", ["guide", "deep-thought", "marvin", "babel-fish"])
def test_story_001_plugin_json_has_name_description_version(plugin):
    """STORY-001: Each plugin.json must have name, description, and version fields."""
    path = os.path.join(REPO_ROOT, "plugins", plugin, ".claude-plugin", "plugin.json")
    assert os.path.exists(path), f"plugin.json missing for '{plugin}'"
    data = json.load(open(path))
    assert "name" in data, f"{plugin}/plugin.json missing 'name'"
    assert "description" in data, f"{plugin}/plugin.json missing 'description'"
    assert "version" in data, f"{plugin}/plugin.json missing 'version'"


@pytest.mark.parametrize("plugin", ["guide", "deep-thought", "marvin", "babel-fish"])
def test_story_001_plugin_json_version_is_0_1_0(plugin):
    """STORY-001: Each plugin.json version must be '0.1.0'."""
    path = os.path.join(REPO_ROOT, "plugins", plugin, ".claude-plugin", "plugin.json")
    assert os.path.exists(path), f"plugin.json missing for '{plugin}'"
    data = json.load(open(path))
    assert data.get("version") == "0.1.0", (
        f"{plugin}/plugin.json version should be '0.1.0', got '{data.get('version')}'"
    )


# ---------------------------------------------------------------------------
# Guide plugin directory structure
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("subdir", ["skills", "scripts", "agents", "knowledge", "defaults"])
def test_story_001_guide_plugin_has_required_subdirectory(subdir):
    """STORY-001: guide plugin must have the full directory structure."""
    path = os.path.join(REPO_ROOT, "plugins", "guide", subdir)
    assert os.path.isdir(path), (
        f"guide plugin missing required directory: plugins/guide/{subdir}"
    )


@pytest.mark.parametrize("skill", ["pipeline", "capture", "write-post"])
def test_story_001_guide_plugin_has_skill_directories(skill):
    """STORY-001: guide plugin must have skill directories for pipeline, capture, write-post."""
    path = os.path.join(REPO_ROOT, "plugins", "guide", "skills", skill, "SKILL.md")
    assert os.path.exists(path), (
        f"guide plugin missing skill file: plugins/guide/skills/{skill}/SKILL.md"
    )


# ---------------------------------------------------------------------------
# Stub plugins: only plugin.json + README.md
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("plugin", ["deep-thought", "marvin", "babel-fish"])
def test_story_001_stub_plugin_has_readme(plugin):
    """STORY-001: Stub plugins must have a README.md."""
    path = os.path.join(REPO_ROOT, "plugins", plugin, "README.md")
    assert os.path.exists(path), f"Stub plugin '{plugin}' missing README.md"


# ---------------------------------------------------------------------------
# Top-level README
# ---------------------------------------------------------------------------

def test_story_001_toplevel_readme_exists():
    """STORY-001: Top-level README.md must exist."""
    path = os.path.join(REPO_ROOT, "README.md")
    assert os.path.exists(path), "Top-level README.md missing"


def test_story_001_readme_mentions_dont_panic():
    """STORY-001: README must mention 'Don't Panic' (the HHGTTG theme)."""
    path = os.path.join(REPO_ROOT, "README.md")
    assert os.path.exists(path)
    content = open(path).read()
    assert "Don't Panic" in content or "Don't Panic" in content, (
        "README.md must mention \"Don't Panic\" to establish the HHGTTG theme"
    )


def test_story_001_readme_includes_marketplace_install_command():
    """STORY-001: README must show the marketplace install command."""
    path = os.path.join(REPO_ROOT, "README.md")
    assert os.path.exists(path)
    content = open(path).read()
    assert "heart-of-gold-toolkit" in content, (
        "README.md must include the install command referencing 'heart-of-gold-toolkit'"
    )


def test_story_001_readme_describes_all_four_plugins():
    """STORY-001: README must mention all four plugin names."""
    path = os.path.join(REPO_ROOT, "README.md")
    assert os.path.exists(path)
    content = open(path).read()
    for name in ["guide", "deep-thought", "marvin", "babel-fish"]:
        assert name in content, f"README.md does not mention plugin '{name}'"
