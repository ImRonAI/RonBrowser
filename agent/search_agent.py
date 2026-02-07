"""
Search Intelligence Agent - orchestrates search with Strands swarm pattern

Integrates multiple search tools:
- Perplexity Deep Research (async)
- Perplexity Sonar Pro (fast search)
- Docker Gateway MCP (100+ tools)
- Healthcare & AudioScrape MCPs
- Code execution via ElectronCodeInterpreter
"""

import logging
import os
from strands import Agent
from strands.models.litellm import LiteLLMModel
from strands.session.file_session_manager import FileSessionManager

logger = logging.getLogger(__name__)
LITELLM_TIMEOUT_SECONDS = int(os.getenv("LITELLM_TIMEOUT_SECONDS", "300"))
LITELLM_STREAM_TIMEOUT_SECONDS = int(os.getenv("LITELLM_STREAM_TIMEOUT_SECONDS", "30"))
LITELLM_DEFAULT_PARAMS = {
    "timeout": LITELLM_TIMEOUT_SECONDS,
    "stream_timeout": LITELLM_STREAM_TIMEOUT_SECONDS,
}

# Import existing tools from superagent
from superagent import (
    http_request,
    mcp_client,
    mem0_memory,
    use_agent,
    workflow,
    swarm,
    graph,
    think,
    environment,
    _global_browser,
)

# Import code interpreter directly
try:
    from strands_tools.code_interpreter.electron_code_interpreter import ElectronCodeInterpreter
    _code_interpreter = None  # Will be initialized when needed
except ImportError:
    _code_interpreter = None

# Import Perplexity tools directly (string paths cause module loading issues)
try:
    from tools.perplexity.perplexity_deep_research import perplexity_deep_research
except ImportError as e:
    logger.warning(f"Could not import perplexity_deep_research: {e}")
    perplexity_deep_research = None

try:
    from tools.perplexity.perplexity_sonar_pro import perplexity_sonar_pro
except ImportError as e:
    logger.warning(f"Could not import perplexity_sonar_pro: {e}")
    perplexity_sonar_pro = None

SEARCH_AGENT_PROMPT = """You are Ron's Search Agent. You coordinate comprehensive search using:

**Primary Search Tools:**
- perplexity_deep_research: Start async deep research EARLY for comprehensive analysis
- perplexity_sonar_pro: Fast web search for quick queries

**Extended Capabilities:**
- mcp_client: Access MCP servers including:
  * Docker Gateway MCP (100+ tools: brave search, apify, arxiv, etc.)
  * Healthcare MCP (medical data sources)
  * AudioScrape MCP (audio content analysis)
- swarm: Delegate to specialized sub-agents when needed
- graph/workflow/use_agent: Orchestrate complex multi-step search workflows
- Code execution: Process data, create visualizations, analyze results

**Gateway Search Mandate:**
- The Docker MCP Gateway is available; use its tools for every user search.
- Run multi-source searches in parallel across:
  * Perplexity Search APIs: perplexity_deep_research + perplexity_sonar_pro
  * Brave Search MCP suite (all six): brave_web_search, brave_news_search, brave_image_search, brave_video_search, brave_local_search, brave_summarizer
  * Apify scrapers (discover via list_tools if needed, then call relevant actors)
  * Bright Data tools (use when available for SERP or site extraction)
- If unsure of tool names, call mcp_client(action="list_tools") and proceed.

**CITATION PROTOCOL (MANDATORY):**
Every single fact MUST have inline citations [1][2][3]. No exceptions.
Example: "The study found 87% efficacy[1] with minimal side effects[2]."

**UI OUTPUT CONTRACT (AI Elements):**
- Use inline citations like [1], [2], [3] that match the order of sources you return.
- When you have a plan, append a valid JSON block: <plan>{"title":"...","description":"...","steps":[{"title":"...","description":"...","status":"pending|running|complete"}],"footer":"..."}</plan>
- When you have a task queue or checklist, append a valid JSON block: <queue>{"label":"...","items":[{"title":"...","description":"...","completed":false}]}</queue>
- Do NOT wrap <plan>/<queue> blocks in code fences.
- Always include at least one <plan> and one <queue> block in the final response, even if minimal.

**Optimal Workflow:**
1. Start perplexity_deep_research IMMEDIATELY (it runs async in background)
2. For specialized needs, use mcp_client to access:
   - Docker Gateway MCP for web scraping, APIs, external data
   - Healthcare MCP for medical/clinical queries
   - AudioScrape MCP for audio content
3. Synthesize all results with inline citations
4. If data analysis needed, execute code for processing/visualization
5. Present final answer with complete citation list

Always prioritize accuracy, cite sources, and leverage parallelism for speed.
"""


def create_search_agent(callback_handler=None, session_id="search"):
    """
    Create search agent with full tool suite

    Args:
        callback_handler: Optional callback for streaming events
        session_id: Session identifier for memory/context

    Returns:
        Configured Strands Agent instance
    """
    # Assemble tool list
    tools = [
        http_request,
        mcp_client,  # KEY: Gives access to all MCP servers
        swarm,
        graph,
        workflow,
        use_agent,
        think,
        mem0_memory,
        environment,
    ]

    # Add perplexity tools if they loaded successfully
    if perplexity_deep_research:
        tools.insert(0, perplexity_deep_research)
    if perplexity_sonar_pro:
        tools.insert(0 if not perplexity_deep_research else 1, perplexity_sonar_pro)

    # Add code interpreter if browser is available
    if _global_browser and ElectronCodeInterpreter:
        try:
            code_interp = ElectronCodeInterpreter(browser=_global_browser)
            tools.append(code_interp.execute_code)
        except Exception as e:
            logger.warning(f"Could not initialize code interpreter: {e}")

    # Filter out None values
    tools = [t for t in tools if t is not None]

    # Kimi K2.5 via NVIDIA NIM LiteLLM
    model = LiteLLMModel(
        model_id="nvidia_nim/moonshotai/kimi-k2.5",
        client_args={
            "api_key": os.getenv("NVIDIA_NIM_API_KEY"),
        },
        params={
            "temperature": 1.0,
            "max_tokens": 200000,
            **LITELLM_DEFAULT_PARAMS,
        }
    )

    # Initialize session manager with the provided session_id
    session_manager = FileSessionManager(session_id=session_id)

    # Create agent
    agent = Agent(
        model=model,
        tools=tools,
        system_prompt=SEARCH_AGENT_PROMPT,
        callback_handler=callback_handler,
        session_manager=session_manager,
    )

    logger.info(f"✅ Search Agent created with {len(tools)} tools")
    return agent
