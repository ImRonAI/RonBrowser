"""Agent spawning tools using Strands use_agent and swarm."""

from typing import Optional, List, Dict, Any
from pathlib import Path

try:
    from agents.Ron.tools.src.strands_tools.use_agent import use_agent
    from agents.Ron.tools.src.strands_tools.swarm import swarm
except ImportError:
    try:
        from strands_tools.use_agent import use_agent
        from strands_tools.swarm import swarm
    except ImportError:
        use_agent = None
        swarm = None


class AgentTools:
    """Tools for spawning sub-agents and coordinating agent swarms.

    Enables recursive agent spawning for:
    - Parallel research tasks
    - Specialized sub-tasks
    - Multi-agent collaboration
    """

    def __init__(self):
        """Initialize agent tools."""
        self._has_use_agent = use_agent is not None
        self._has_swarm = swarm is not None

    def spawn_agent(
        self,
        objective: str,
        tools: Optional[List[str]] = None,
        agent_name: Optional[str] = None,
        max_iterations: int = 10,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Spawn a sub-agent to handle a specific task.

        Creates a new agent instance to work on a specific objective.
        The sub-agent can use its own tools and reason independently.

        Args:
            objective: What the sub-agent should accomplish
            tools: List of tool names the sub-agent can use
            agent_name: Optional name for the sub-agent
            max_iterations: Maximum reasoning iterations
            context: Additional context to pass to sub-agent

        Returns:
            Sub-agent's result
        """
        if not self._has_use_agent:
            return "Agent spawning not available. Install strands-tools."

        try:
            import uuid
            name = agent_name or f"subagent_{uuid.uuid4().hex[:8]}"

            result = use_agent(
                agent_name=name,
                objective=objective,
                tools=tools or [],
                max_iterations=max_iterations,
                context=context or {},
            )

            if isinstance(result, dict):
                if "response" in result:
                    return f"[{name}] {result['response']}"
                if "result" in result:
                    return f"[{name}] {result['result']}"
            return f"[{name}] {str(result)}"

        except Exception as e:
            return f"Agent spawn error: {str(e)}"

    def run_swarm(
        self,
        objective: str,
        num_agents: int = 3,
        agent_roles: Optional[List[str]] = None,
        coordination_strategy: str = "parallel",
    ) -> str:
        """Run a coordinated swarm of agents.

        Spawns multiple agents that work together on an objective.
        Useful for:
        - Research from multiple perspectives
        - Divide-and-conquer tasks
        - Redundancy and consensus

        Args:
            objective: Shared objective for the swarm
            num_agents: Number of agents to spawn
            agent_roles: Optional role descriptions for each agent
            coordination_strategy: 'parallel', 'sequential', or 'hierarchical'

        Returns:
            Aggregated swarm results
        """
        if not self._has_swarm:
            return "Swarm coordination not available. Install strands-tools."

        try:
            result = swarm(
                objective=objective,
                num_agents=num_agents,
                agent_roles=agent_roles or [],
                coordination_strategy=coordination_strategy,
            )

            if isinstance(result, dict):
                # Format swarm results
                outputs = []
                if "results" in result:
                    for i, r in enumerate(result["results"]):
                        outputs.append(f"Agent {i+1}: {r}")
                    return "\n".join(outputs)
                if "consensus" in result:
                    return f"Swarm consensus: {result['consensus']}"
            return str(result)

        except Exception as e:
            return f"Swarm error: {str(e)}"

    def delegate_research(
        self,
        topic: str,
        depth: str = "moderate",
        sources: Optional[List[str]] = None,
    ) -> str:
        """Delegate a research task to a specialized sub-agent.

        Convenience method for spawning a research-focused agent.

        Args:
            topic: Research topic
            depth: Research depth ('quick', 'moderate', 'thorough')
            sources: Preferred information sources

        Returns:
            Research results
        """
        tools = ["fetch_url", "read_file", "run_shell"]
        if sources:
            context = {"preferred_sources": sources}
        else:
            context = {}

        depth_instructions = {
            "quick": "Provide a brief overview, focusing on key points only.",
            "moderate": "Provide a balanced summary with supporting details.",
            "thorough": "Conduct comprehensive research with multiple perspectives.",
        }

        objective = f"""Research the following topic: {topic}

Instructions: {depth_instructions.get(depth, depth_instructions['moderate'])}

Gather relevant information and provide a structured summary."""

        return self.spawn_agent(
            objective=objective,
            tools=tools,
            agent_name="research_agent",
            max_iterations=15 if depth == "thorough" else 10,
            context=context,
        )
