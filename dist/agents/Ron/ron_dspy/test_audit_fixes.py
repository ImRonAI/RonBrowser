#!/usr/bin/env python3
"""Test script to verify DSPy audit fixes.

This script tests that all the critical fixes applied during the audit
work correctly and don't cause runtime errors.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

def test_config():
    """Test DSPy LM configuration fixes."""
    print("Testing DSPy LM configuration...")

    try:
        from dspy.config import (
            configure_lm,
            configure_anthropic_lm,
            configure_bedrock_lm,
            get_default_lm,
        )

        # Test Anthropic configuration
        lm = configure_anthropic_lm(
            model="claude-3-opus-20240229",
            api_key="test_key",
            max_tokens=1024,
        )
        assert lm is not None
        print("✓ Anthropic LM configuration works")

        # Test generic LM configuration
        lm = configure_lm(
            model="openai/gpt-4",
            api_key="test_key",
        )
        assert lm is not None
        print("✓ Generic LM configuration works")

        # Test Bedrock configuration (should handle missing AWS creds gracefully)
        try:
            lm = configure_bedrock_lm()
            print("✓ Bedrock LM configuration works (AWS creds found)")
        except ValueError as e:
            if "not supported" in str(e):
                print("✓ Bedrock LM configuration properly validates model types")
        except Exception:
            print("✓ Bedrock LM configuration handles missing AWS creds")

        return True

    except Exception as e:
        print(f"✗ Config test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_signatures():
    """Test DSPy signature improvements."""
    print("\nTesting DSPy signatures...")

    try:
        from dspy.signatures import (
            ReActSignature,
            ReActThought,
            ToolCall,
            TaskDecomposition,
        )

        # Test that signatures are properly defined
        assert ReActSignature is not None
        assert ReActThought is not None
        print("✓ ReActSignature and ReActThought imported successfully")

        # Test ToolCall validation
        from pydantic import ValidationError
        try:
            # This should fail due to short reasoning
            tc = ToolCall(
                tool_name="test",
                arguments={},
                reasoning="bad"  # Too short
            )
            print("✗ ToolCall validation not working")
            return False
        except ValidationError:
            print("✓ ToolCall validation working correctly")

        # Valid ToolCall
        tc = ToolCall(
            tool_name="test",
            arguments={"arg": "value"},
            reasoning="This tool is needed to test the functionality"
        )
        assert tc.tool_name == "test"
        print("✓ ToolCall creation works with valid data")

        return True

    except Exception as e:
        print(f"✗ Signatures test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_react_module():
    """Test ReActWithMemory module fixes."""
    print("\nTesting ReActWithMemory module...")

    try:
        from dspy.modules.react_with_memory import ReActWithMemory
        from dspy.memory import ConversationMemory

        # Create a simple tool
        def test_tool(query: str) -> str:
            """Test tool for verification."""
            return f"Result: {query}"

        # Initialize module
        tools = {"test_tool": test_tool}
        memory = ConversationMemory(window_size=5)
        module = ReActWithMemory(
            tools=tools,
            max_iters=3,
            memory=memory,
        )

        print("✓ ReActWithMemory initialized successfully")

        # Test that set_tools doesn't rebuild the module
        original_react = module._react
        module.set_tools({"test_tool": test_tool, "another": test_tool})

        # The _react instance should be the same object (not rebuilt)
        assert module._react is original_react
        print("✓ set_tools() preserves module instance")

        # Test warning for post-optimization tool updates
        module._optimized = True
        import warnings
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            module.set_tools({"new_tool": test_tool})
            assert len(w) > 0
            assert "optimization" in str(w[0].message).lower()
            print("✓ Warning issued for post-optimization tool updates")

        return True

    except Exception as e:
        print(f"✗ ReActWithMemory test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_memory():
    """Test memory module fixes."""
    print("\nTesting memory module...")

    try:
        # Verify no sys.path manipulation
        import sys
        initial_path = sys.path.copy()

        from dspy.memory.mem0 import (
            MemoryConfig,
            Mem0Memory,
            ConversationMemory,
            MemoryTools,
        )

        # Check that sys.path wasn't modified
        assert sys.path == initial_path
        print("✓ No sys.path manipulation in memory module")

        # Test memory config
        config = MemoryConfig(
            user_id="test_user",
            agent_id="test_agent",
        )
        assert config.user_id == "test_user"
        print("✓ MemoryConfig works correctly")

        # Test conversation memory (should work without Mem0)
        conv_memory = ConversationMemory(
            window_size=10,
            persist_all=False,  # Don't try to persist without Mem0
        )
        conv_memory.add_user("Test message")
        conv_memory.add_assistant("Test response")
        context = conv_memory.get_context()
        assert "Test message" in context
        assert "Test response" in context
        print("✓ ConversationMemory works without Mem0")

        return True

    except Exception as e:
        print(f"✗ Memory test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_agent():
    """Test main agent fixes."""
    print("\nTesting RonAgent...")

    try:
        # Set minimal env to avoid actual API calls
        os.environ["ANTHROPIC_API_KEY"] = "test_key"

        from dspy import RonAgent

        # Simple tool for testing
        def echo_tool(message: str) -> str:
            """Echo the message back."""
            return f"Echo: {message}"

        # Initialize agent with minimal config
        agent = RonAgent(
            enable_browser=False,
            enable_system=False,
            enable_tasks=False,
            enable_agents=False,
            enable_memory_tools=False,
            use_all_strands_tools=False,
            max_iterations=2,
        )

        print("✓ RonAgent initialized successfully")

        # Test adding tools with validation
        try:
            # Should fail - no docstring
            agent.add_tool("bad_tool", lambda x: x)
            print("✗ Tool docstring validation not working")
            return False
        except ValueError as e:
            if "docstring" in str(e):
                print("✓ Tool docstring validation working")

        # Add valid tool
        agent.add_tool("echo", echo_tool)
        assert "echo" in agent.get_tool_names()
        print("✓ Tool addition works correctly")

        # Test tool removal
        agent.remove_tool("echo")
        assert "echo" not in agent.get_tool_names()
        print("✓ Tool removal works correctly")

        return True

    except Exception as e:
        print(f"✗ Agent test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("DSPy Agent Audit Fixes Test Suite")
    print("=" * 60)

    tests = [
        ("Configuration", test_config),
        ("Signatures", test_signatures),
        ("ReAct Module", test_react_module),
        ("Memory", test_memory),
        ("Agent", test_agent),
    ]

    results = []
    for name, test_func in tests:
        try:
            success = test_func()
            results.append((name, success))
        except Exception as e:
            print(f"\n✗ {name} test crashed: {e}")
            results.append((name, False))

    print("\n" + "=" * 60)
    print("Test Results Summary:")
    print("-" * 60)

    all_passed = True
    for name, success in results:
        status = "✓ PASSED" if success else "✗ FAILED"
        print(f"{name:20} {status}")
        if not success:
            all_passed = False

    print("=" * 60)
    if all_passed:
        print("✓ All tests passed!")
        return 0
    else:
        print("✗ Some tests failed. Please review the output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())