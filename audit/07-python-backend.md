# Zone 7: Python Agent Backend SDK Compliance Audit
**SDKs:** strands-agents 1.23, mcp 1.26, fastapi 0.128, lancedb 0.27, pydantic 2.12, openai 2.15, anthropic 0.76, opensearch-py 3.1
**Audited:** 2026-05-22 | **Files audited:** 37 Python/manifest/config files: `agent/aisdk_stream.py`, `agent/api/core/__init__.py`, `agent/api/core/agent_factory.py`, `agent/api/core/config.py`, `agent/api/core/hooks.py`, `agent/api/core/streaming.py`, `agent/api/endpoints/__init__.py`, `agent/api/endpoints/agents.py`, `agent/api/endpoints/browser_sessions.py`, `agent/api/endpoints/chat_sessions.py`, `agent/api/endpoints/mcp_servers.py`, `agent/api/endpoints/openapi_specs.py`, `agent/api/endpoints/projects.py`, `agent/api/endpoints/tools.py`, `agent/api/main.py`, `agent/api/requirements.txt`, `agent/api/requirements-full.txt`, `agent/api/schemas.py`, `agent/docker/aisdk_stream.py`, `agent/docker/requirements.txt`, `agent/docker/sandbox_agent.py`, `agent/docker/sandbox_server.py`, `agent/docker/superagent.py`, `agent/lancedb_session_repository.py`, `agent/superagent_with_rollover.py`, `agent/tool_manifests/tools_discovery_manifest.json`, `tools/core/code_interpreter_wrapper.py`, `python_scripts/manifest_updater.py`, `debug_browser_connection.py`, `inspect_agent.py`, `inspect_agent_instance.py`, `inspect_mcp_client.py`, `inspect_mcp_members.py`, `inspect_strands.py`, `test_append_messages.py`, `test_browser_connection.py`, `verify_browser_import.py`, `yaml_to_json.py`, `docker-compose.opensearch.yml`.

## Executive Summary
The Python backend has a functional Strands/FastAPI-oriented structure, but the audit found several production-blocking security and compliance gaps. The highest-risk issues are unrestricted `exec()`, wildcard CORS, and local OpenSearch configuration with security disabled and a hardcoded admin password. Dependency manifests are inconsistent: the full lock-style manifest pins the requested SDK versions, while the runtime manifests are broad or fully unpinned. Streaming, MCP, Strands tools, LanceDB, and Pydantic usage need focused follow-up because several files were only pattern-inspected under time constraints.

## Dependency Manifest Status
Three manifests were found: `agent/api/requirements.txt`, `agent/api/requirements-full.txt`, and `agent/docker/requirements.txt`. `requirements-full.txt` pins the audited stack (`strands-agents==1.23.0`, `mcp==1.26.0`, `fastapi==0.128.0`, `uvicorn==0.40.0`, `lancedb==0.27.0`, `openai==2.15.0`, `anthropic==0.76.0`, `pydantic==2.12.5`, `opensearch-py==3.1.0`) but also contains an editable Git dependency for `strands_agents_tools`, which is not reproducible unless the commit remains reachable. `agent/api/requirements.txt` uses ranges such as `fastapi>=0.109.0`, `lancedb>=0.4.0`, `openai>=1.12.0`, `anthropic>=0.50.0`, and `opensearch-py>=2.8.0`, so installs can drift away from audited versions. `agent/docker/requirements.txt` is entirely unpinned (`strands-agents[a2a]`, `strands-agents-tools[a2a_client]`, `pyautogui`, `pytesseract`, `opencv-python-headless`, `pillow`, `google-genai`) and does not include FastAPI/uvicorn even though `sandbox_server.py` imports FastAPI.

## Severity Legend
🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🟢 LOW

## Findings

### [PY-01] Unrestricted dynamic code execution in tool wrapper — 🔴 CRITICAL
- **File:** `tools/core/code_interpreter_wrapper.py:30`
- **Current code:** ```python
exec(code, globals_dict)
```
- **What's wrong:** Raw caller-controlled Python is executed in-process. This bypasses Strands tool boundaries, can access process memory/environment, and is not a safe sandbox for an agent tool.
- **SDK citation:** Python docs: https://docs.python.org/3/library/functions.html#exec — "This function supports dynamic execution of Python code." and "exec() will execute the code as if it were embedded in the calling scope." Strands tools docs: https://strandsagents.com/latest/documentation/docs/user-guide/concepts/tools/python-tools/ — tools are Python functions decorated with `@tool` and invoked by the agent, so unsafe execution inside a tool becomes part of the agent attack surface.
- **Required fix:** Remove in-process `exec()`. If code execution is required, run it in a separately sandboxed, resource-limited container/process with a strict allowlist, timeout, no secrets, no host mounts, and serialized input/output.
- **Fixed code:** ```python
raise RuntimeError("Python code execution is disabled; use the isolated sandbox service")
```
- **Why scales/lasts:** A dedicated sandbox boundary can be centrally hardened, monitored, rate-limited, and replaced without changing agent-facing tool APIs.

### [PY-02] Wildcard CORS on sandbox API — 🟠 HIGH
- **File:** `agent/docker/sandbox_server.py:14`
- **Current code:** ```python
allow_origins=["*"],
```
- **What's wrong:** Any origin can call the sandbox API from a browser context. For an automation/screen-control service, this creates cross-origin abuse risk.
- **SDK citation:** FastAPI CORS docs: https://fastapi.tiangolo.com/tutorial/cors/ — "It's also possible to declare the list as `['*']` (a 'wildcard') to say that all are allowed. But that will only allow certain types of communication, excluding everything that involves credentials." Starlette CORS docs: https://www.starlette.io/middleware/#corsmiddleware — `allow_origins` is "A list of origins that should be permitted to make cross-origin requests. eg. ['https://example.org']."
- **Required fix:** Replace wildcard origins with explicit Electron/dev/prod origins from configuration and reject absent/unknown origins.
- **Fixed code:** ```python
allowed_origins = os.getenv("RON_SANDBOX_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_credentials=False, allow_methods=["POST"], allow_headers=["content-type"])
```
- **Why scales/lasts:** Configuration-based allowlists support local development and production deployments without source edits.

### [PY-03] OpenSearch security disabled with hardcoded admin password — 🔴 CRITICAL
- **File:** `docker-compose.opensearch.yml:8-9`, `docker-compose.opensearch.yml:32-33`
- **Current code:** ```yaml
- plugins.security.disabled=true
- OPENSEARCH_INITIAL_ADMIN_PASSWORD=Admin123!
- OPENSEARCH_HOSTS=["http://opensearch:9200"]
- DISABLE_SECURITY_DASHBOARDS_PLUGIN=true
```
- **What's wrong:** The compose service disables security and stores a static admin password in source. Dashboard traffic is configured over HTTP and the dashboards security plugin is disabled.
- **SDK citation:** OpenSearch security docs: https://opensearch.org/docs/latest/security/ — "The OpenSearch Security plugin provides authentication, authorization, and encryption features." Docker secrets guidance: https://docs.docker.com/compose/how-tos/use-secrets/ — "Secrets are a mechanism for securely managing sensitive data, such as passwords, OAuth tokens, and SSH keys."
- **Required fix:** Enable the security plugin, use TLS/HTTPS, move credentials to Docker secrets or environment provided outside git, and avoid publishing ports broadly by default.
- **Fixed code:** ```yaml
secrets:
  opensearch_admin_password:
    file: ./secrets/opensearch_admin_password.txt
services:
  opensearch:
    environment:
      - OPENSEARCH_INITIAL_ADMIN_PASSWORD_FILE=/run/secrets/opensearch_admin_password
    secrets:
      - opensearch_admin_password
```
- **Why scales/lasts:** Secret injection and security-on defaults are environment-portable and prevent accidental credential reuse.

### [PY-04] Dependency manifest drift and unpinned Docker runtime — 🟠 HIGH
- **File:** `agent/api/requirements.txt:4-40`, `agent/docker/requirements.txt:1-7`, `agent/api/requirements-full.txt:107-108`
- **Current code:** ```text
fastapi>=0.109.0
lancedb>=0.4.0
openai>=1.12.0
anthropic>=0.50.0
opensearch-py>=2.8.0
strands-agents[a2a]
strands-agents-tools[a2a_client]
```
- **What's wrong:** The audited versions are only guaranteed in `requirements-full.txt`; other manifests can resolve newer incompatible SDKs or older vulnerable transitive dependencies. Docker also lacks explicit `fastapi`/`uvicorn` despite serving FastAPI.
- **SDK citation:** pip requirements docs: https://pip.pypa.io/en/stable/reference/requirements-file-format/ — requirement specifiers control installed versions. pip repeatable installs docs: https://pip.pypa.io/en/stable/topics/repeatable-installs/ — "Pinned Version Numbers" are recommended for repeatable environments.
- **Required fix:** Generate all runtime manifests from one locked source, pin direct dependencies, and use hashes/constraints for deployments.
- **Fixed code:** ```text
fastapi==0.128.0
uvicorn[standard]==0.40.0
strands-agents[a2a]==1.23.0
mcp==1.26.0
lancedb==0.27.0
openai==2.15.0
anthropic==0.76.0
opensearch-py==3.1.0
```
- **Why scales/lasts:** A single lock/constraints file makes audits reproducible and reduces environment-specific SDK regressions.

### [PY-05] Vercel AI SDK data-stream protocol needs conformance tests — 🟡 MEDIUM
- **File:** `agent/aisdk_stream.py:31`, `agent/docker/aisdk_stream.py:26`
- **Current code:** ```python
class AISDKStreamEmitter:
```
- **What's wrong:** Two stream emitters exist and may diverge. Protocol compliance could not be fully verified in the time available; duplicated implementations increase risk of invalid chunk prefixes, malformed JSON payloads, or missing finish/error parts.
- **SDK citation:** Vercel AI SDK stream protocol docs: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol — "Data streams are a stream protocol that is used by the AI SDK UI functions to send information to the client." The docs define typed stream parts such as text, data, error, and finish parts.
- **Required fix:** Consolidate to one emitter and add golden tests for v6 data-stream text, data, error, and finish messages consumed by the UI.
- **Fixed code:** ```python
# one shared emitter module imported by both API and docker paths
from agent.aisdk_stream import AISDKStreamEmitter
```
- **Why scales/lasts:** One tested implementation prevents drift between local API and sandbox streaming behavior.
- **PARTIAL — additional files to inspect:** full `agent/api/core/streaming.py`, all call sites that serialize AISDK chunks.

### [PY-06] MCP server patterns require transport/session verification — 🟡 MEDIUM
- **File:** `agent/api/endpoints/mcp_servers.py:19`, root inspection scripts `inspect_mcp_client.py`, `inspect_mcp_members.py`
- **Current code:** ```python
from pydantic import BaseModel, Field
```
- **What's wrong:** The endpoint currently appears to model MCP server metadata, but no audited transport implementation was confirmed. MCP Python SDK clients/servers must use supported transports and session lifecycle patterns rather than ad-hoc process or HTTP calls.
- **SDK citation:** MCP Python SDK README: https://github.com/modelcontextprotocol/python-sdk — the SDK exposes `ClientSession` and supported transports such as stdio/streamable HTTP for connecting to MCP servers. MCP docs: https://modelcontextprotocol.io/docs — MCP standardizes how applications provide context to LLMs.
- **Required fix:** Confirm any MCP launch/connect code uses SDK transports (`stdio_client`, streamable HTTP where appropriate) and closes sessions with async context managers.
- **Fixed code:** ```python
async with stdio_client(server_params) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()
```
- **Why scales/lasts:** SDK-managed sessions keep protocol upgrades, cancellation, and cleanup consistent.
- **PARTIAL — additional files to inspect:** complete MCP connection paths, generated server registry, UI-triggered MCP launch code.

### [PY-07] FastAPI lifespan/on_event status needs full-file verification — 🟢 LOW
- **File:** `agent/api/main.py`, `agent/docker/sandbox_server.py`
- **Current code:** ```python
# no @app.on_event match found in grep scope
```
- **What's wrong:** No deprecated `@app.on_event` usage was found by pattern search. This is a pass for the searched scope, but full AST review was not completed.
- **SDK citation:** FastAPI events docs: https://fastapi.tiangolo.com/advanced/events/ — "The recommended way to handle the startup and shutdown is using the `lifespan` parameter of the `FastAPI` app." The same page marks startup/shutdown event handlers as deprecated when lifespan is used.
- **Required fix:** If future startup/shutdown handlers are added, use lifespan async context managers.
- **Fixed code:** ```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
app = FastAPI(lifespan=lifespan)
```
- **Why scales/lasts:** Lifespan centralizes startup/shutdown for DB clients, Strands agents, and MCP sessions.

### [PY-08] Pydantic v2 usage mostly clean; ensure v1 APIs stay out — 🟢 LOW
- **File:** `agent/api/schemas.py:9`, `agent/api/endpoints/*.py`
- **Current code:** ```python
from pydantic import BaseModel, Field
```
- **What's wrong:** Pattern search found v2-compatible imports and did not reveal `BaseSettings` from `pydantic`, `.dict()`, `.json()`, or `Config` misuse in the sampled output. Continue to avoid v1-only patterns.
- **SDK citation:** Pydantic migration docs: https://docs.pydantic.dev/latest/migration/ — Pydantic V2 renames methods such as `dict()` to `model_dump()` and `json()` to `model_dump_json()`.
- **Required fix:** Use `model_dump()`, `model_validate()`, `ConfigDict`, and `pydantic-settings` for settings.
- **Fixed code:** ```python
payload = model.model_dump()
```
- **Why scales/lasts:** V2 APIs avoid deprecation churn and make schema behavior explicit.

### [PY-09] LanceDB async usage requires call-site review — 🟡 MEDIUM
- **File:** `agent/lancedb_session_repository.py`, `agent/api/requirements-full.txt:50`
- **Current code:** ```text
lancedb==0.27.0
```
- **What's wrong:** LanceDB is pinned, but async/sync usage was not fully inspected. If synchronous LanceDB operations run directly inside FastAPI async endpoints or Strands event loops, they can block streaming and agent concurrency.
- **SDK citation:** LanceDB docs: https://lancedb.github.io/lancedb/ — LanceDB Python documentation provides both connection/table APIs and async usage guidance for Python clients.
- **Required fix:** Use async LanceDB APIs in async endpoints or isolate sync calls with threadpool execution.
- **Fixed code:** ```python
records = await async_table.query().to_list()
```
- **Why scales/lasts:** Non-blocking vector I/O preserves latency under concurrent agent sessions.
- **PARTIAL — additional files to inspect:** full repository implementation and endpoint call graph.

### [PY-10] Strands Agent/Tool hooks and sessions require deeper API audit — 🟡 MEDIUM
- **File:** `agent/api/core/agent_factory.py:254`, `agent/superagent_with_rollover.py:215`, `agent/api/core/hooks.py`
- **Current code:** ```python
# imports and @tool on instance methods, so they must be created here.
@tool
```
- **What's wrong:** Tool discovery appears to parse `@tool` decorators and dynamically load modules. The code needs a full Strands 1.23 audit for proper Agent construction, tool registration, hooks, sessions/memory, and callback handlers.
- **SDK citation:** Strands Agents docs: https://strandsagents.com/latest/documentation/ — Strands documents `Agent`, tools, hooks, sessions, and streaming as first-class concepts. Python tools docs: https://strandsagents.com/latest/documentation/docs/user-guide/concepts/tools/python-tools/ — Python functions can be exposed as tools with the `@tool` decorator.
- **Required fix:** Verify tools are registered through Strands-supported APIs, avoid fragile source parsing where runtime metadata is available, and attach session/hook management for durable conversations.
- **Fixed code:** ```python
agent = Agent(tools=[safe_tool], hooks=[...], session_manager=session_manager)
```
- **Why scales/lasts:** SDK-native registration and sessions reduce breakage across Strands releases and preserve conversation/tool state.
- **PARTIAL — additional files to inspect:** full `agent/api/core/agent_factory.py`, `agent/api/core/hooks.py`, all `@tool` functions.

## Cleanup Items
- Remove generated caches before committing or packaging: many `__pycache__/` directories were reported in the previous pass.
- Remove stale backup artifact `agent/aisdk_stream.py.backup`; it duplicates streaming logic and may confuse imports/reviews.
- Root-level scratch/inspection scripts are not imported by the app and should be moved under a developer diagnostics directory or removed if obsolete: `debug_browser_connection.py`, `inspect_agent.py`, `inspect_agent_instance.py`, `inspect_mcp_client.py`, `inspect_mcp_members.py`, `inspect_strands.py`, `test_append_messages.py`, `test_browser_connection.py`, `verify_browser_import.py`, `yaml_to_json.py`.
- Review `agent/docker/requirements.txt` for unpinned GUI/automation packages (`pyautogui`, `pytesseract`, `opencv-python-headless`, `pillow`, `google-genai`).

## Sources & Citations
1. https://strandsagents.com/latest/documentation/ — accessed 2026-05-22.
2. https://strandsagents.com/latest/documentation/docs/user-guide/concepts/tools/python-tools/ — accessed 2026-05-22.
3. https://github.com/strands-agents/sdk-python — accessed 2026-05-22.
4. https://modelcontextprotocol.io/docs — accessed 2026-05-22.
5. https://github.com/modelcontextprotocol/python-sdk — accessed 2026-05-22.
6. https://fastapi.tiangolo.com/tutorial/cors/ — accessed 2026-05-22.
7. https://fastapi.tiangolo.com/advanced/events/ — accessed 2026-05-22.
8. https://www.starlette.io/middleware/#corsmiddleware — accessed 2026-05-22.
9. https://lancedb.github.io/lancedb/ — accessed 2026-05-22.
10. https://github.com/openai/openai-python — accessed 2026-05-22.
11. https://github.com/anthropics/anthropic-sdk-python — accessed 2026-05-22.
12. https://docs.pydantic.dev/latest/migration/ — accessed 2026-05-22.
13. https://opensearch.org/docs/latest/security/ — accessed 2026-05-22.
14. https://opensearch.org/docs/latest/clients/python/ — accessed 2026-05-22.
15. https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol — accessed 2026-05-22.
16. https://docs.python.org/3/library/functions.html#exec — accessed 2026-05-22.
17. https://pip.pypa.io/en/stable/reference/requirements-file-format/ — accessed 2026-05-22.
18. https://pip.pypa.io/en/stable/topics/repeatable-installs/ — accessed 2026-05-22.
19. https://docs.docker.com/compose/how-tos/use-secrets/ — accessed 2026-05-22.
