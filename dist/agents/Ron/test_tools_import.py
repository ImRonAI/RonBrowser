#!/usr/bin/env python3
"""Test script to verify all tools import correctly."""

import sys
from pathlib import Path

# Add Ron to path
ron_path = Path(__file__).parent
sys.path.insert(0, str(ron_path))

def test_imports():
    """Test importing all tools."""
    print("Testing tool imports...")
    print("=" * 60)

    try:
        # Import the tools module
        from tools import (
            CORE_TOOLS,
            FUNCTION_TOOLS,
            DICT_TOOLS,
            ALL_TOOLS,
            TOOL_SPECS,
            list_available_tools,
            BROWSER_AVAILABLE,
            CODE_INTERPRETER_AVAILABLE,
        )

        print(f"✓ Successfully imported tools module")
        print(f"  - Core tools: {len(CORE_TOOLS)}")
        print(f"  - Function tools: {len(FUNCTION_TOOLS)}")
        print(f"  - Dict tools: {len(DICT_TOOLS)}")
        print(f"  - All tools: {len(ALL_TOOLS)}")
        print(f"  - Tool specs: {len(TOOL_SPECS)}")
        print(f"  - Browser available: {BROWSER_AVAILABLE}")
        print(f"  - Code interpreter available: {CODE_INTERPRETER_AVAILABLE}")

        print("\n" + "=" * 60)
        print("Available tools:")
        print("-" * 60)

        available = list_available_tools()
        for i, tool_name in enumerate(available, 1):
            print(f"  {i:3}. {tool_name}")

        print("\n" + "=" * 60)
        print(f"Total: {len(available)} tools available")

        # Test specific imports
        print("\n" + "=" * 60)
        print("Testing specific tool imports...")

        from tools import editor, shell, file_read, file_write, think
        print("✓ Core tools imported successfully")

        from tools import calculator, tavily_search, mcp_client
        print("✓ Function tools imported successfully")

        from tools import agent_graph, python_repl, use_aws
        print("✓ Dict tools imported successfully")

        from tools import A2AClientToolProvider, AgentCoreMemoryToolProvider
        print("✓ Class-based providers imported successfully")

        print("\n" + "=" * 60)
        print("✓ All tests passed!")

        return True

    except Exception as e:
        print(f"\n✗ Error importing tools: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_imports()
    sys.exit(0 if success else 1)