
import asyncio
import os
import sys

# Add current directory to path
# Add agent directory to path so we can resolve aisdk_stream
agent_dir = os.path.join(os.getcwd(), 'agent')
if agent_dir not in sys.path:
    sys.path.append(agent_dir)


from agent.superagent import create_superagent, load_mcp_server, unload_mcp_server, _mcp_clients

async def verify_lifecycle():
    print("--- Starting MCP Lifecycle Verification ---")
    
    # 1. Create agent
    print("1. Creating agent...")
    agent = create_superagent()
    
    # Check initial tools
    initial_tool_count = len(agent.tool_registry.registry)
    print(f"Initial tool count: {initial_tool_count}")
    
    # 2. Load MCP server
    # We use 'mcp-installer' as it should be relatively safe and fast
    server_id = "mcp-installer" 
    print(f"\n2. Loading MCP server: {server_id}...")
    
    # Call the tool function directly (it's decorated, so we need to call it as a coroutine or handle the tool wrapper)
    # The @tool decorator wraps the function. In Strands, the original function is usually available/callable, 
    # but `load_mcp_server` is async.
    
    # Since we are running outside the agent loop, we need to manually invoke the underlying logic 
    # OR we can just use the agent to invoke it!
    # Let's use the underlying function logic for direct control if possible, 
    # BUT `load_mcp_server` relies on `_current_agent` global which we set in `create_superagent`.
    
    # We can try invoking via agent to be most realistic, but async tools in synchronous `agent(...)` call might be tricky 
    # if using `agent(prompt)`. 
    # `superagent.py` uses `load_mcp_server` which is async. Strands Agent handles async tools.
    
    # Let's call the function directly. The decorator usually preserves `__call__`.
    # `load_mcp_server` is an `AsyncAgentTool` or similar. 
    # If it's a `tool` decorator from `strands`, it might return a Tool object. 
    # Checking `superagent.py`: `@tool \n async def load_mcp_server...`
    
    # Inspect the tool object
    print(f"Type of load_mcp_server: {type(load_mcp_server)}")
    
    try:
        if isinstance(load_mcp_server, list):
            tool_obj = load_mcp_server[0]
        else:
            tool_obj = load_mcp_server
            
        print(f"Tool object type: {type(tool_obj)}")
        
        # In Strands, the underlying function is often at .fn or .func
        if hasattr(tool_obj, 'fn'):
            print("Calling via .fn")
            result = await tool_obj.fn(server_id=server_id)
        elif hasattr(tool_obj, 'func'):
             print("Calling via .func")
             result = await tool_obj.func(server_id=server_id)
        else:
            # Maybe it's callable directly?
            result = await tool_obj(server_id=server_id)
            
        print(f"Load result: {result}")
    except Exception as e:
        print(f"Load failed: {e}")
        import traceback
        traceback.print_exc()


    # 3. Verify Loaded State
    print("\n3. Verifying Load State...")
    current_count = len(agent.tool_registry.registry)
    print(f"Current tool count: {current_count}")
    
    if current_count <= initial_tool_count:
        print("❌ FAILURE: No new tools registered.")
    else:
        print(f"✅ SUCCESS: {current_count - initial_tool_count} tools added.")
        
    # Check if in global keys
    if server_id in _mcp_clients:
        print(f"✅ SUCCESS: {server_id} found in _mcp_clients.")
        print(f"Tools stored: {_mcp_clients[server_id]['tool_names']}")
    else:
        print(f"❌ FAILURE: {server_id} NOT found in _mcp_clients.")

    # 4. Unload MCP Server
    print(f"\n4. Unloading MCP server: {server_id}...")
    unload_result = unload_mcp_server(server_id=server_id)
    print(f"Unload result: {unload_result}")

    # 5. Verify Unloaded State
    print("\n5. Verifying Unload State...")
    final_count = len(agent.tool_registry.registry)
    print(f"Final tool count: {final_count}")
    
    if final_count != initial_tool_count:
        print(f"❌ FAILURE: Tool count mismatch. Expected {initial_tool_count}, got {final_count}.")
        print("Remaining tools might include orphans.")
    else:
        print("✅ SUCCESS: Tool count returned to initial state.")

    if server_id not in _mcp_clients:
        print(f"✅ SUCCESS: {server_id} removed from _mcp_clients.")
    else:
        print(f"❌ FAILURE: {server_id} still in _mcp_clients.")

if __name__ == "__main__":
    asyncio.run(verify_lifecycle())
