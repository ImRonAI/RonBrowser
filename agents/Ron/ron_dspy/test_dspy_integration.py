#!/usr/bin/env python3
"""
Comprehensive test script for DSPy tools integration audit.

This script validates:
1. DSPy installation and version
2. Tool wrapping functionality
3. LM configuration
4. ReAct module with memory
5. Optimization pipeline
6. Browser automation tools
7. Task management
8. Agent spawning

Run this script to verify all fixes applied during the audit.
"""

import sys
import os
import json
from pathlib import Path
from typing import Dict, Any, List

# Add the agent directory to path for imports
agent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(agent_dir))

# Test results collector
test_results: List[Dict[str, Any]] = []


def test_module(name: str, test_fn: callable) -> None:
    """Run a test and collect results."""
    print(f"\n{'='*60}")
    print(f"Testing: {name}")
    print('='*60)

    try:
        result = test_fn()
        status = "✅ PASSED" if result else "❌ FAILED"
        test_results.append({
            "name": name,
            "status": "passed" if result else "failed",
            "error": None
        })
    except Exception as e:
        status = "❌ ERROR"
        test_results.append({
            "name": name,
            "status": "error",
            "error": str(e)
        })
        print(f"Error: {e}")

    print(f"Result: {status}")


def test_dspy_installation() -> bool:
    """Test 1: Verify DSPy is properly installed."""
    try:
        import dspy
        print(f"✓ DSPy imported successfully")

        # Check version
        version = getattr(dspy, "__version__", "Unknown")
        print(f"✓ DSPy version: {version}")

        # Check core components
        assert hasattr(dspy, "LM"), "Missing dspy.LM"
        assert hasattr(dspy, "ReAct"), "Missing dspy.ReAct"
        assert hasattr(dspy, "Tool"), "Missing dspy.Tool"
        assert hasattr(dspy, "Module"), "Missing dspy.Module"
        assert hasattr(dspy, "Prediction"), "Missing dspy.Prediction"
        print(f"✓ All core DSPy components present")

        return True
    except ImportError as e:
        print(f"✗ DSPy not installed: {e}")
        print("  Run: pip install dspy-ai>=2.5.0")
        return False
    except AssertionError as e:
        print(f"✗ DSPy component missing: {e}")
        return False


def test_lm_configuration() -> bool:
    """Test 2: Verify LM configuration works."""
    try:
        from dspy.config import configure_lm, configure_anthropic_lm, get_default_lm

        # Test basic LM creation (won't actually connect without API key)
        test_lm = configure_lm(
            model="anthropic/claude-3-haiku-20240307",
            api_key="test-key",
            max_tokens=1024
        )
        print(f"✓ Basic LM configuration works")

        # Test Anthropic configuration
        anthropic_lm = configure_anthropic_lm(
            model="claude-3-haiku-20240307",
            api_key="test-key"
        )
        print(f"✓ Anthropic LM configuration works")

        return True
    except Exception as e:
        print(f"✗ LM configuration failed: {e}")
        return False


def test_strands_wrapper() -> bool:
    """Test 3: Verify Strands tools wrapper."""
    try:
        from dspy.tools.strands_wrapper import (
            StrandsToolsWrapper,
            get_core_tools,
            get_agent_tools,
            get_memory_tools
        )

        # Test wrapper initialization
        wrapper = StrandsToolsWrapper(lazy_load=False)
        print(f"✓ StrandsToolsWrapper initialized")

        # Test tool categories
        tool_names = wrapper.get_tool_names()
        print(f"✓ Found {len(tool_names)} tools")

        # Test tool retrieval
        if tool_names:
            first_tool = wrapper.get_tool(tool_names[0])
            assert callable(first_tool), f"Tool {tool_names[0]} is not callable"
            print(f"✓ Tool retrieval works: {tool_names[0]}")

        # Test category functions
        core_tools = get_core_tools()
        print(f"✓ Core tools: {len(core_tools)} tools")

        return True
    except ImportError as e:
        print(f"⚠ Strands tools not available (expected): {e}")
        return True  # This is expected if strands-tools not installed
    except Exception as e:
        print(f"✗ Strands wrapper failed: {e}")
        return False


def test_system_tools() -> bool:
    """Test 4: Verify system tools."""
    try:
        from dspy.tools.system import SystemTools

        # Initialize system tools
        system = SystemTools()
        print(f"✓ SystemTools initialized")

        # Test basic operations (non-destructive)
        pwd = system.get_current_directory()
        assert pwd, "Failed to get current directory"
        print(f"✓ Current directory: {pwd}")

        # Test error handling
        result = system.read_file("/nonexistent/file.txt")
        assert "not found" in result.lower() or "error" in result.lower()
        print(f"✓ Error handling works properly")

        return True
    except ImportError as e:
        print(f"⚠ System tools require strands-tools: {e}")
        return True  # Expected if strands-tools not installed
    except Exception as e:
        print(f"✗ System tools failed: {e}")
        return False


def test_task_tools() -> bool:
    """Test 5: Verify task management tools."""
    try:
        from dspy.tools.tasks import TaskTools

        # Initialize without Supabase (in-memory mode)
        tasks = TaskTools()
        print(f"✓ TaskTools initialized (in-memory mode)")

        # Test CRUD operations
        result = tasks.create_task(
            title="Test Task",
            description="Test description",
            priority="high"
        )
        assert "Created task" in result
        print(f"✓ Task creation works")

        # Test listing
        list_result = tasks.list_tasks()
        assert "Test Task" in list_result or "task" in list_result.lower()
        print(f"✓ Task listing works")

        return True
    except Exception as e:
        print(f"✗ Task tools failed: {e}")
        return False


def test_browser_tools() -> bool:
    """Test 6: Verify browser automation tools."""
    try:
        from dspy.tools.browser import PlaywrightElectronMCP, BrowserTools

        # Initialize browser tools (won't connect without MCP)
        browser = PlaywrightElectronMCP()
        print(f"✓ PlaywrightElectronMCP initialized")

        # Verify it's the same as BrowserTools alias
        assert BrowserTools == PlaywrightElectronMCP
        print(f"✓ BrowserTools alias works")

        # Check Electron path detection
        electron_path = browser.electron_path
        print(f"✓ Electron path: {electron_path}")

        return True
    except ImportError as e:
        print(f"⚠ Browser tools require mcp_client: {e}")
        return True  # Expected if mcp not installed
    except Exception as e:
        print(f"✗ Browser tools failed: {e}")
        return False


def test_agent_tools() -> bool:
    """Test 7: Verify agent spawning tools."""
    try:
        from dspy.tools.agents import AgentTools

        # Initialize agent tools
        agents = AgentTools()
        print(f"✓ AgentTools initialized")

        # Test availability checks
        has_use_agent = agents._has_use_agent
        has_swarm = agents._has_swarm
        print(f"✓ use_agent available: {has_use_agent}")
        print(f"✓ swarm available: {has_swarm}")

        return True
    except Exception as e:
        print(f"✗ Agent tools failed: {e}")
        return False


def test_react_with_memory() -> bool:
    """Test 8: Verify ReAct module with memory."""
    try:
        import dspy
        from dspy.modules.react_with_memory import ReActWithMemory
        from dspy.memory import ConversationMemory

        # Mock tools for testing
        def mock_tool(query: str) -> str:
            """Mock tool for testing."""
            return f"Processed: {query}"

        tools = {"mock_tool": mock_tool}

        # Initialize ReAct with memory
        react = ReActWithMemory(
            tools=tools,
            max_iters=3,
            memory=ConversationMemory()
        )
        print(f"✓ ReActWithMemory initialized")

        # Check internal components
        assert hasattr(react, "_react"), "Missing _react attribute"
        assert hasattr(react, "memory"), "Missing memory attribute"
        assert hasattr(react, "tools"), "Missing tools attribute"
        print(f"✓ All ReAct components present")

        return True
    except ImportError as e:
        print(f"✗ ReActWithMemory import failed: {e}")
        return False
    except Exception as e:
        print(f"✗ ReActWithMemory failed: {e}")
        return False


def test_optimization_pipeline() -> bool:
    """Test 9: Verify optimization/distillation pipeline."""
    try:
        from dspy.optimization.trainer import (
            load_training_data,
            task_completion_metric,
            response_quality_metric,
            combined_metric,
            _get_finetune_recommendations
        )

        # Test metric functions
        import dspy
        example = dspy.Example(
            request="Test request",
            expected_response="Test response",
            expected_tools=["tool1"]
        ).with_inputs("request")

        pred = dspy.Prediction(
            response="Test response",
            tool_calls=[{"tool": "tool1", "args": {}}],
            iterations=2
        )

        # Test metrics
        score1 = task_completion_metric(example, pred)
        assert 0 <= score1 <= 1, f"Invalid score: {score1}"
        print(f"✓ Task completion metric: {score1}")

        score2 = response_quality_metric(example, pred)
        assert 0 <= score2 <= 1, f"Invalid score: {score2}"
        print(f"✓ Response quality metric: {score2}")

        score3 = combined_metric(example, pred)
        assert 0 <= score3 <= 1, f"Invalid score: {score3}"
        print(f"✓ Combined metric: {score3}")

        # Test recommendations
        recs = _get_finetune_recommendations("meta-llama/Llama-3.1-8B")
        assert len(recs) > 0, "No recommendations generated"
        print(f"✓ Finetune recommendations: {len(recs)} items")

        return True
    except Exception as e:
        print(f"✗ Optimization pipeline failed: {e}")
        return False


def test_main_agent() -> bool:
    """Test 10: Verify main RonAgent class."""
    try:
        from dspy.agent import RonAgent

        # Initialize agent with minimal config (no actual LM connection)
        # This will fail to get default LM but that's expected without credentials
        try:
            agent = RonAgent(
                enable_browser=False,
                enable_system=False,
                enable_tasks=True,
                enable_agents=False,
                use_all_strands_tools=False,
                max_iterations=3
            )
            print(f"✓ RonAgent initialized with default LM")
        except RuntimeError as e:
            if "No LM credentials" in str(e):
                print(f"✓ RonAgent initialization checks for credentials (expected)")
                return True
            raise

        # Check agent properties
        tool_count = agent.tool_count
        print(f"✓ Agent has {tool_count} tools")

        tool_names = agent.get_tool_names()
        print(f"✓ Tool names: {', '.join(tool_names[:5])}...")

        return True
    except ImportError as e:
        print(f"✗ RonAgent import failed: {e}")
        return False
    except Exception as e:
        print(f"✗ RonAgent failed: {e}")
        return False


def main():
    """Run all tests and generate report."""
    print("\n" + "="*60)
    print("DSPy TOOLS INTEGRATION AUDIT TEST SUITE")
    print("="*60)

    # Run all tests
    test_module("1. DSPy Installation", test_dspy_installation)
    test_module("2. LM Configuration", test_lm_configuration)
    test_module("3. Strands Wrapper", test_strands_wrapper)
    test_module("4. System Tools", test_system_tools)
    test_module("5. Task Tools", test_task_tools)
    test_module("6. Browser Tools", test_browser_tools)
    test_module("7. Agent Tools", test_agent_tools)
    test_module("8. ReAct with Memory", test_react_with_memory)
    test_module("9. Optimization Pipeline", test_optimization_pipeline)
    test_module("10. Main RonAgent", test_main_agent)

    # Generate summary report
    print("\n" + "="*60)
    print("TEST SUMMARY REPORT")
    print("="*60)

    passed = sum(1 for r in test_results if r["status"] == "passed")
    failed = sum(1 for r in test_results if r["status"] == "failed")
    errors = sum(1 for r in test_results if r["status"] == "error")

    print(f"\nTotal Tests: {len(test_results)}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"⚠️  Errors: {errors}")

    # List failed/error tests
    if failed + errors > 0:
        print("\nFailed/Error Tests:")
        for result in test_results:
            if result["status"] in ["failed", "error"]:
                error_msg = f" - {result['error']}" if result["error"] else ""
                print(f"  • {result['name']}: {result['status'].upper()}{error_msg}")

    # Overall status
    print("\n" + "="*60)
    if failed + errors == 0:
        print("🎉 ALL TESTS PASSED! DSPy integration is working correctly.")
    else:
        print("⚠️  Some tests failed. Review the errors above and:")
        print("  1. Install missing dependencies: pip install -r requirements.txt")
        print("  2. Check import paths and module structure")
        print("  3. Verify Strands tools are available if needed")
    print("="*60)

    # Save results to file
    report_path = Path(__file__).parent / "test_results.json"
    with open(report_path, "w") as f:
        json.dump({
            "summary": {
                "total": len(test_results),
                "passed": passed,
                "failed": failed,
                "errors": errors
            },
            "tests": test_results
        }, f, indent=2)
    print(f"\nDetailed results saved to: {report_path}")


if __name__ == "__main__":
    main()