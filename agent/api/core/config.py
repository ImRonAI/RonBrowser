"""
Configuration for Ron Browser API.
"""

import os
from pathlib import Path


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _parse_sliding_per_turn(raw: str) -> bool | int:
    normalized = raw.strip().lower()
    if normalized in {"false", "0", "off", "no"}:
        return False
    if normalized in {"true", "1", "on", "yes"}:
        return True
    parsed = int(normalized)
    if parsed <= 0:
        raise ValueError("SLIDING_PER_TURN must be false/true or a positive integer")
    return parsed


# API Configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
API_PORT = int(os.getenv("API_PORT", "8765"))
API_HOST = os.getenv("API_HOST", "0.0.0.0")

# External API Keys
NVIDIA_NIM_API_KEY = os.getenv("NVIDIA_NIM_API_KEY")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

# Optional OpenAI realtime org/project scoping
OPENAI_ORGANIZATION = os.getenv("OPENAI_ORGANIZATION")
OPENAI_PROJECT = os.getenv("OPENAI_PROJECT")

# Optional AWS settings for Nova Sonic
AWS_REGION = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or os.getenv("REGION")

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# LanceDB Configuration (for future use)
LANCEDB_URI = os.getenv("LANCEDB_URI", "db://default")
LANCEDB_API_KEY = os.getenv("LANCEDB_API_KEY")

# Agent Configuration
AGENT_TIMEOUT_SECONDS = int(os.getenv("AGENT_TIMEOUT_SECONDS", "14400"))
# Guardrail for stalled model/tool streams that produce no events.
AGENT_STREAM_EVENT_TIMEOUT_SECONDS = int(os.getenv("AGENT_STREAM_EVENT_TIMEOUT_SECONDS", "45"))
SESSION_STORAGE_DIR = Path(os.getenv("SESSION_STORAGE_DIR", ".sessions"))

# Conversation Management Configuration
# Supported values: "sliding", "summarizing", "null"
CONVERSATION_MANAGER_TYPE = os.getenv("CONVERSATION_MANAGER_TYPE", "sliding").lower()

# SlidingWindowConversationManager
SLIDING_WINDOW_SIZE = int(os.getenv("SLIDING_WINDOW_SIZE", "80"))
SLIDING_TRUNCATE_TOOL_RESULTS = _env_bool("SLIDING_TRUNCATE_TOOL_RESULTS", True)
# False, True, or positive int (e.g. "5")
try:
    SLIDING_PER_TURN = _parse_sliding_per_turn(os.getenv("SLIDING_PER_TURN", "5"))
except ValueError:
    SLIDING_PER_TURN = False

# SummarizingConversationManager
SUMMARY_RATIO = float(os.getenv("SUMMARY_RATIO", "0.3"))
PRESERVE_RECENT_MESSAGES = int(os.getenv("PRESERVE_RECENT_MESSAGES", "10"))

# Hooks Configuration
ENABLE_AGENT_LOOP_OBSERVER_HOOK = _env_bool("ENABLE_AGENT_LOOP_OBSERVER_HOOK", True)
HOOKS_VERBOSE_LOGGING = _env_bool("HOOKS_VERBOSE_LOGGING", False)

# Guardrail hook: per-invocation tool call limit (0 disables)
MAX_TOOL_CALLS_PER_INVOCATION = int(os.getenv("MAX_TOOL_CALLS_PER_INVOCATION", "200"))

# Experimental hook alias compatibility layer (deprecated aliases in strands.experimental.hooks)
ENABLE_EXPERIMENTAL_HOOK_ALIASES = _env_bool("ENABLE_EXPERIMENTAL_HOOK_ALIASES", False)

# Experimental Steering (disabled by default)
ENABLE_EXPERIMENTAL_STEERING = _env_bool("ENABLE_EXPERIMENTAL_STEERING", False)
STEERING_SYSTEM_PROMPT = os.getenv(
    "STEERING_SYSTEM_PROMPT",
    "You are a steering evaluator. Allow normal tool usage. "
    "Only intervene when there are repeated failures, runaway tool loops, or unsafe behavior patterns.",
)

# Structured Output Configuration
# Default Pydantic model for structured output - empty to disable by default (causes slow loops)
DEFAULT_STRUCTURED_OUTPUT_MODEL = os.getenv("DEFAULT_STRUCTURED_OUTPUT_MODEL", "")

# SuperAgent Bidi Configuration
ENABLE_SUPERAGENT_BIDI = _env_bool("ENABLE_SUPERAGENT_BIDI", True)
# Supported values: "openai", "gemini", "nova", "auto"
SUPERAGENT_BIDI_PROVIDER = os.getenv("SUPERAGENT_BIDI_PROVIDER", "openai").strip().lower()
SUPERAGENT_BIDI_MODEL_ID = os.getenv("SUPERAGENT_BIDI_MODEL_ID", "").strip()
ALLOW_SUPERAGENT_BIDI_PROVIDER_FALLBACK = _env_bool("ALLOW_SUPERAGENT_BIDI_PROVIDER_FALLBACK", True)
SUPERAGENT_BIDI_REQUIRE_PROVIDER = _env_bool("SUPERAGENT_BIDI_REQUIRE_PROVIDER", True)

# Provider-specific optional tuning
SUPERAGENT_BIDI_OPENAI_VOICE = os.getenv("SUPERAGENT_BIDI_OPENAI_VOICE", "coral")
SUPERAGENT_BIDI_GEMINI_VOICE = os.getenv("SUPERAGENT_BIDI_GEMINI_VOICE", "Kore")
SUPERAGENT_BIDI_NOVA_VOICE = os.getenv("SUPERAGENT_BIDI_NOVA_VOICE", "matthew")
SUPERAGENT_BIDI_OPENAI_TIMEOUT_SECONDS = int(os.getenv("SUPERAGENT_BIDI_OPENAI_TIMEOUT_SECONDS", "3000"))

# Browser Configuration
BROWSER_CDP_PORT = int(os.getenv("BROWSER_CDP_PORT", "9222"))
BROWSER_HEADLESS = _env_bool("BROWSER_HEADLESS", False)

# MCP Configuration
MCP_TIMEOUT_SECONDS = int(os.getenv("MCP_TIMEOUT_SECONDS", "30"))

# Tool Discovery
TOOLS_SRC_DIR = Path(__file__).parent.parent.parent / "tools" / "src" / "strands_tools"

# Agent Sandbox — all file/shell/journal operations are rooted here
import platform as _platform

def _default_sandbox_root() -> Path:
    if _platform.system() == "Darwin":
        base = Path.home() / "Library" / "Application Support"
    elif _platform.system() == "Windows":
        base = Path(os.getenv("APPDATA", str(Path.home())))
    else:
        base = Path(os.getenv("XDG_DATA_HOME", str(Path.home() / ".local" / "share")))
    return base / "RonBrowser" / "agent-sandbox"

AGENT_SANDBOX_ROOT = Path(os.getenv("RON_AGENT_SANDBOX_ROOT", str(_default_sandbox_root())))
AGENT_SANDBOX_ROOT.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("RON_AGENT_SANDBOX_ROOT", str(AGENT_SANDBOX_ROOT))

# Discovery manifest path (shared by API endpoints and tool catalog manager)
_DEFAULT_DISCOVERY_MANIFEST_PATH = Path(__file__).parent.parent.parent / "tool_manifests" / "tools_discovery_manifest.json"
_configured_discovery_manifest = os.getenv("STRANDS_TOOL_DISCOVERY_MANIFEST") or os.getenv("TOOL_DISCOVERY_MANIFEST")
DISCOVERY_MANIFEST_PATH = (
    Path(_configured_discovery_manifest).expanduser()
    if _configured_discovery_manifest
    else _DEFAULT_DISCOVERY_MANIFEST_PATH
)

# Keep both env names aligned so all components read/write the same manifest.
os.environ.setdefault("TOOL_DISCOVERY_MANIFEST", str(DISCOVERY_MANIFEST_PATH))
os.environ.setdefault("STRANDS_TOOL_DISCOVERY_MANIFEST", str(DISCOVERY_MANIFEST_PATH))
