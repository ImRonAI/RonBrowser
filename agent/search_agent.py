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
from ron_gemini import RonGeminiModel
from google import genai
from strands.session.file_session_manager import FileSessionManager

logger = logging.getLogger(__name__)

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

**CITATION PROTOCOL (MANDATORY):**
Every single fact MUST have inline citations [1][2][3]. No exceptions.
Example: "The study found 87% efficacy[1] with minimal side effects[2]."

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

    # Gemini 3 Flash Preview with high reasoning
    model = RonGeminiModel(
        model_id="gemini-3-pro-preview",
        client_args={
            "api_key": os.getenv("GOOGLE_API_KEY"),
        },
        params={
            "temperature": 1.0,
            "max_output_tokens": 65536,
            "thinking_config": genai.types.ThinkingConfig(
                thinking_level="HIGH",  # Maximum reasoning depth
                include_thoughts=True   # Expose reasoning tokens
            )
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
