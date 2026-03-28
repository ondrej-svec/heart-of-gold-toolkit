"""
STORY-017: Marketplace README and documentation

Tests verify:

Top-level README:
- exists at repo root
- mentions "Don't Panic" (HHGTTG theme)
- provides the marketplace install command
- provides individual plugin install commands
- describes each of the 4 plugins in 1-2 sentences
- links to each plugin's own README

Guide plugin README:
- exists at plugins/guide/README.md
- explains what the guide plugin does (content pipeline overview)
- has a Quick Start section
- describes Quick Start steps: install, create config, run /guide:pipeline
- has a Configuration reference section
- lists all 3 available skills: /guide:pipeline, /guide:capture, /guide:write-post
- includes an example output (sample daily brief)

Cross-cutting:
- Both READMEs must be self-contained (no HHGTTG knowledge required)
  i.e., all HHGTTG references have plain-English explanations alongside them
"""
import os
import re
import pytest
from conftest import REPO_ROOT, GUIDE_ROOT

TOP_README = os.path.join(REPO_ROOT, "README.md")
GUIDE_README = os.path.join(GUIDE_ROOT, "README.md")


# ---------------------------------------------------------------------------
# Top-level README existence and basic content
# ---------------------------------------------------------------------------

def test_story_017_toplevel_readme_exists():
    """STORY-017: Top-level README.md must exist at the repo root."""
    assert os.path.exists(TOP_README), (
        f"Top-level README.md not found at {TOP_README}. "
        "Create heart-of-gold-toolkit/README.md with marketplace overview."
    )


def _read_top_readme():
    assert os.path.exists(TOP_README), f"Top-level README not found at {TOP_README}"
    return open(TOP_README).read()


def test_story_017_toplevel_readme_mentions_dont_panic():
    """STORY-017: Top-level README must mention 'Don't Panic' (the central HHGTTG theme)."""
    content = _read_top_readme()
    assert "Don't Panic" in content or "Don't Panic" in content, (
        "Top-level README must mention \"Don't Panic\". "
        "This is the HHGTTG-themed introduction required by the story."
    )


def test_story_017_toplevel_readme_has_marketplace_install_command():
    """STORY-017: Top-level README must include the marketplace install command."""
    content = _read_top_readme()
    assert "heart-of-gold-toolkit" in content, (
        "Top-level README must include the install command. "
        "Example: /plugin marketplace add ondrej-svec/heart-of-gold-toolkit"
    )
    assert re.search(r'/plugin.*marketplace|marketplace.*add', content, re.IGNORECASE), (
        "Top-level README must include the /plugin marketplace add ... install command"
    )


def test_story_017_toplevel_readme_has_individual_plugin_install_commands():
    """STORY-017: Top-level README must show individual plugin install commands."""
    content = _read_top_readme()
    # At minimum the guide plugin's install command
    has_plugin_install = (
        re.search(r'/plugin.*install.*guide', content, re.IGNORECASE)
        or re.search(r'plugin.*add.*guide', content, re.IGNORECASE)
        or re.search(r'install.*guide', content, re.IGNORECASE)
    )
    assert has_plugin_install, (
        "Top-level README must show individual plugin install commands. "
        "Users may only want to install 'guide', not all plugins."
    )


@pytest.mark.parametrize("plugin_name", ["guide", "deep-thought", "marvin", "babel-fish"])
def test_story_017_toplevel_readme_describes_each_plugin(plugin_name):
    """STORY-017: Top-level README must describe each of the 4 plugins."""
    content = _read_top_readme()
    assert plugin_name in content, (
        f"Top-level README must mention the '{plugin_name}' plugin. "
        "Each plugin needs a 1-2 sentence description."
    )


def test_story_017_toplevel_readme_links_to_plugin_readmes():
    """STORY-017: Top-level README must link to each plugin's individual README."""
    content = _read_top_readme()
    # Should have links like plugins/guide/README.md or guide/README.md
    has_plugin_links = (
        re.search(r'plugins/guide', content)
        or re.search(r'\[.*guide.*\]\(.*README', content, re.IGNORECASE)
        or re.search(r'guide/README', content, re.IGNORECASE)
    )
    assert has_plugin_links, (
        "Top-level README must link to each plugin's own README. "
        "Example: [Guide Plugin](plugins/guide/README.md)"
    )


# ---------------------------------------------------------------------------
# Guide plugin README existence and content
# ---------------------------------------------------------------------------

def test_story_017_guide_readme_exists():
    """STORY-017: plugins/guide/README.md must exist."""
    assert os.path.exists(GUIDE_README), (
        f"Guide plugin README not found at {GUIDE_README}. "
        "Create plugins/guide/README.md with plugin documentation."
    )


def _read_guide_readme():
    assert os.path.exists(GUIDE_README), f"Guide README not found at {GUIDE_README}"
    return open(GUIDE_README).read()


def test_story_017_guide_readme_describes_content_pipeline():
    """STORY-017: Guide README must describe the content pipeline (what it does)."""
    content = _read_guide_readme()
    has_pipeline_desc = (
        "pipeline" in content.lower()
        or re.search(r'content.*creation', content, re.IGNORECASE)
        or re.search(r'daily.*brief', content, re.IGNORECASE)
        or re.search(r'automat.*content', content, re.IGNORECASE)
    )
    assert has_pipeline_desc, (
        "Guide README must provide a content pipeline overview (what the plugin does). "
        "This is the first thing a new user reads."
    )


def test_story_017_guide_readme_has_quick_start_section():
    """STORY-017: Guide README must have a Quick Start section."""
    content = _read_guide_readme()
    assert re.search(r'quick.?start', content, re.IGNORECASE), (
        "Guide README must have a 'Quick Start' section. "
        "New users need to get running in < 5 minutes."
    )


def test_story_017_guide_readme_quick_start_mentions_install():
    """STORY-017: Guide README Quick Start must include the install step."""
    content = _read_guide_readme()
    assert re.search(r'install|/plugin', content, re.IGNORECASE), (
        "Guide README Quick Start must show how to install the guide plugin."
    )


def test_story_017_guide_readme_quick_start_mentions_config():
    """STORY-017: Guide README Quick Start must include the config creation step."""
    content = _read_guide_readme()
    has_config_step = (
        "config.yaml" in content
        or re.search(r'creat.*config', content, re.IGNORECASE)
        or re.search(r'config.*setup', content, re.IGNORECASE)
    )
    assert has_config_step, (
        "Guide README Quick Start must show how to create content/config.yaml."
    )


def test_story_017_guide_readme_quick_start_mentions_pipeline_skill():
    """STORY-017: Guide README Quick Start must mention /guide:pipeline."""
    content = _read_guide_readme()
    assert re.search(r'/guide:pipeline|guide.*pipeline', content, re.IGNORECASE), (
        "Guide README Quick Start must show how to run /guide:pipeline. "
        "This is the main entry point for users."
    )


def test_story_017_guide_readme_has_configuration_reference():
    """STORY-017: Guide README must have a Configuration reference section."""
    content = _read_guide_readme()
    assert re.search(r'configuration|config.*reference|config.*section', content, re.IGNORECASE), (
        "Guide README must have a Configuration reference section explaining all config options."
    )


@pytest.mark.parametrize("skill", ["/guide:pipeline", "/guide:capture", "/guide:write-post"])
def test_story_017_guide_readme_lists_all_skills(skill):
    """STORY-017: Guide README must list all 3 available skills."""
    content = _read_guide_readme()
    # Match both with and without the leading slash (e.g. guide:pipeline or /guide:pipeline)
    skill_pattern = skill.lstrip("/").replace(":", r"[:\s]")
    assert re.search(skill_pattern, content, re.IGNORECASE) or skill in content, (
        f"Guide README must mention the '{skill}' skill. "
        "Users need to know what skills are available."
    )


def test_story_017_guide_readme_has_example_output():
    """STORY-017: Guide README must include an example output (sample daily brief)."""
    content = _read_guide_readme()
    has_example = (
        re.search(r'example', content, re.IGNORECASE)
        or re.search(r'sample', content, re.IGNORECASE)
        or re.search(r'must.?read', content, re.IGNORECASE)
        or re.search(r'worth.a.look', content, re.IGNORECASE)
        or re.search(r'rabbit.hole', content, re.IGNORECASE)
        # Code blocks are common for example output
        or "```" in content
    )
    assert has_example, (
        "Guide README must include an example output — a sample daily brief. "
        "This helps users understand what they'll get before installing."
    )


# ---------------------------------------------------------------------------
# Self-contained (no HHGTTG knowledge required)
# ---------------------------------------------------------------------------

def test_story_017_toplevel_readme_explains_hhgttg_references():
    """STORY-017: Top-level README must be self-contained — HHGTTG references need plain explanations."""
    content = _read_top_readme()
    # If the README uses HHGTTG character names, it should also explain them in plain English
    hhgttg_names = ["babel fish", "marvin", "deep thought", "hitchhiker"]
    used_names = [n for n in hhgttg_names if re.search(n, content, re.IGNORECASE)]
    if not used_names:
        # No HHGTTG names used → nothing to explain, test passes
        return
    # If HHGTTG names are used, there should also be plain English descriptions nearby
    # (the test can't verify proximity, but checks that descriptive words exist)
    has_plain_description = (
        re.search(r'reasoning|quality|media|content|translation', content, re.IGNORECASE)
        or re.search(r'plugin.*for|used for|helps', content, re.IGNORECASE)
    )
    assert has_plain_description, (
        f"Top-level README uses HHGTTG references ({used_names}) but must also include "
        "plain-English descriptions so users who haven't read the books can understand. "
        "Example: 'Babel Fish (Universal Translator) — media generation'"
    )


def test_story_017_guide_readme_understandable_without_hhgttg():
    """STORY-017: Guide README must be fully functional without HHGTTG knowledge."""
    content = _read_guide_readme()
    # Must have a plain-language description of what it does
    has_plain_desc = (
        re.search(r'content.*pipeline', content, re.IGNORECASE)
        or re.search(r'daily.*brief', content, re.IGNORECASE)
        or re.search(r'blog.*post', content, re.IGNORECASE)
        or re.search(r'linkedin', content, re.IGNORECASE)
    )
    assert has_plain_desc, (
        "Guide README must describe what the plugin does in plain language. "
        "A user who has never heard of HHGTTG must be able to understand what it does."
    )
