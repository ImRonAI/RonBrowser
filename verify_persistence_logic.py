
import asyncio
import sys
import os
from unittest.mock import MagicMock, AsyncMock, patch

# Add project root to path
sys.path.append(os.getcwd())

# Mock lancedb before importing main
mock_lancedb = MagicMock()
mock_pyarrow = MagicMock()
mock_pyarrow.__version__ = "10.0.0"
sys.modules["lancedb"] = mock_lancedb
sys.modules["pyarrow"] = mock_pyarrow

# Import the module under test
# We need to handle relative imports in main.py
sys.path.append(os.path.join(os.getcwd(), "agent"))

from agent.api import main

async def test_persistence():
    print("--- Testing Persistence Logic ---")
    
    # Mock Request
    mock_request = MagicMock()
    mock_request.json = AsyncMock(return_value={
        "message": "hello",
        "session_id": "test-session"
    })
    
    # Mock Memory
    mock_memory = MagicMock()
    mock_memory.get_messages.return_value = [
        {"role": "user", "content": "prev_msg", "citations_json": "[]"},
        {"role": "assistant", "content": "prev_response", "citations_json": "[]"}
    ]
    main.memory = mock_memory
    
    # Mock Agent
    mock_agent = MagicMock()
    # Mock agent call (the lambda) logic? 
    # The agent is called in a thread executor: loop.run_in_executor(None, lambda: agent(message))
    # We need agent instances to have 'messages' attribute
    mock_agent.messages = [
        {"role": "user", "content": "prev_msg"},
        {"role": "assistant", "content": "prev_response"}
    ]
    
    # Define side effect for agent call to add new messages
    def agent_call(msg):
        print(f"Agent called with: {msg}")
        mock_agent.messages.append({"role": "user", "content": msg})
        mock_agent.messages.append({"role": "assistant", "content": "response"})
        return "done"
    
    mock_agent.side_effect = agent_call
    
    # Mock create_superagent
    with patch("agent.api.main.create_superagent", return_value=mock_agent) as mock_create:
        
        # Run superagent_stream
        # It returns a StreamingResponse, handled by FastAPI. 
        # But we called `superagent_stream`... no, it returns StreamingResponse object.
        # We need to access the generator inside it.
        
        response = await main.superagent_stream(mock_request)
        generator = response.body_iterator # Starlette/FastAPI internals
        
        # Iterate generator to trigger logic
        print("Iterating stream...")
        async for item in generator:
            pass
            
        print("Stream finished.")
        
        # Verify History Loading
        mock_memory.get_messages.assert_called_with("test-session", limit=1000)
        print("✅ memory.get_messages called")
        
        # Verify create_superagent history
        expected_history = [
            {"role": "user", "content": "prev_msg"},
            {"role": "assistant", "content": "prev_response"}
        ]
        args, kwargs = mock_create.call_args
        assert kwargs["history"] == expected_history
        print("✅ create_superagent called with correct history")
        
        # Verify Saving New Messages
        # logic: initial_count=2, added 2 (user+assistant). 
        # Persistence loop should add these 2.
        
        # memory.add_message call args
        calls = mock_memory.add_message.call_args_list
        print(f"add_message calls: {len(calls)}")
        
        for call in calls:
            print(f" - {call}")
            
        assert len(calls) >= 2
        # Check first call (user message)
        args0 = calls[0].args
        assert args0[0] == "test-session"
        assert args0[1] == "user"
        assert args0[2] == "hello"
        
        # Check second call (assistant response)
        args1 = calls[1].args
        assert args1[1] == "assistant"
        assert args1[2] == "response"
        
        print("✅ New messages synced to memory")

if __name__ == "__main__":
    asyncio.run(test_persistence())
