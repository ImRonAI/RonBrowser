To achieve this, you will initialize a `BedrockModel` instance with the
    specified `model_id`, `streaming=True`, and `additional_request_fields` for
    thinking budget. This `BedrockModel` instance will then be passed to the
    `Agent` constructor, along with an instance of `ConcurrentToolExecutor`.

    ## Configuring BedrockModel for Streaming and Extended Thinking

    First, you need to create a `BedrockModel` instance. To enable streaming, set
    the `streaming` parameter to `True` in the `BedrockModel` constructor.

    For extended thinking (interleaved thinking) with Claude Opus 4.5, you'll
    specify the `model_id` as "global.anthropic.claude-opus-4-5-20251101-v1:0"
    and include `additional_request_fields` with
     a "thinking" object. This object should have a `type` of "enabled" and a
    `budget_tokens` field to define the thinking budget.

    Here's an example of how to configure the `BedrockModel`:
    ```python
    from strands.models import BedrockModel

    bedrock_model = BedrockModel(
        
        additional_request_fields={
            "thinking": {
                "type": "enabled",
                "budget_tokens": 2000,  # Set your desired thinking budget
            }
        },
    )
    ```

    The `additional_request_fields` parameter is used to pass extra fields
    directly to the Bedrock request, which is how extended thinking is enabled.

    ## Agent Initialization with ConcurrentToolExecutor

    Next, you will initialize the `Agent` with the `bedrock_model` created above
    and a `ConcurrentToolExecutor`. The `ConcurrentToolExecutor` enables parallel
    execution of tools.

    ```python
    from strands import Agent
    from strands.tools.executors import ConcurrentToolExecutor

    # ... (bedrock_model definition from above)

    agent = Agent(
        model=bedrock_model,
        tool_executor=ConcurrentToolExecutor(),
        # Add any other desired agent configurations here, e.g., tools,
    system_prompt
    )
    ```

    The `tool_executor` parameter in the `Agent` constructor accepts an instance
    of `ToolExecutor`. By default, if no `tool_executor` is provided,
    `ConcurrentToolExecutor` is used.  However, explicitly setting it ensures
    clarity. The `ConcurrentToolExecutor`'s `_execute` method handles the
    asynchronous execution of multiple tools.

    ## Complete Example

    Here is the complete initialization:
    ```python
    from strands import Agent
    from strands.models import BedrockModel
    from strands.tools.executors import ConcurrentToolExecutor
    from strands import tool
    import asyncio

    # Define a sample tool for demonstration
    @tool
    async def get_current_time() -> str:
        """Returns the current time."""
        await asyncio.sleep(1) # Simulate some work
        return "10:30 AM"

    @tool
    async def get_weather(location: str) -> str:
        """Returns the current weather for a given location."""
        await asyncio.sleep(2) # Simulate some work
        return f"Sunny in {location}"

    # Configure BedrockModel with streaming and extended thinking
    bedrock_model = BedrockModel(
        model_id="global.anthropic.claude-opus-4-5-20251101-v1:0",  # Claude Opus 4.5
        streaming=True,
        additional_request_fields={
            "thinking": {
                "type": "enabled",
                "budget_tokens": 2000,  # Thinking budget in tokens
            }
        },
    )

    # Initialize the Agent with the configured BedrockModel and
    ConcurrentToolExecutor
    agent = Agent(
        model=bedrock_model,
        tools=[get_current_time, get_weather], # Provide your tools here
        tool_executor=ConcurrentToolExecutor(),
        system_prompt="You are a helpful AI assistant that can use tools and
    thinks step-by-step."
    )

    # Example invocation
    async def main():
        print("Agent initialized. Invoking agent...")
        result = await agent.invoke_async("What is the current time and the
    weather in London?")
        print(f"Agent response: {result.message['content'][0]['text']}")

    if __name__ == "__main__":
        asyncio.run(main())
    ```

    ## Notes

    The `BedrockModel.BedrockConfig` class defines the available configuration
    options for `BedrockModel`, including `streaming` and
    `additional_request_fields`.  The `Agent` class's `__init__` method accepts a
    `model` instance and a `tool_executor` instance.  The `ConcurrentToolExecutor`
     is imported from `strands.tools.executors`.

    Wiki pages you might want to explore:
    - [API Reference
    (strands-agents/sdk-python)](/wiki/strands-agents/sdk-python#8)

    View this search on DeepWiki: https://deepwiki.com/search/how-do-i-configure-b
    edrockmode_0dfb38a5-6a4d-43a8-a842-70cd6547b3e9
