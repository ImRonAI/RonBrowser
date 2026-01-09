strands.experimental.bidi.tools ¶
Built-in tools for bidirectional agents.

strands.experimental.bidi.tools.stop_conversation ¶
Tool to gracefully stop a bidirectional connection.

stop_conversation() ¶
Stop the bidirectional conversation gracefully.

Use ONLY when user says "stop conversation" exactly. Do NOT use for: "stop", "goodbye", "bye", "exit", "quit", "end" or other farewells or phrases.

Returns:

Type	Description
str	Success message confirming the conversation will end@tool
def stop_conversation() -> str:
    """Stop the bidirectional conversation gracefully.

    Use ONLY when user says "stop conversation" exactly.
    Do NOT use for: "stop", "goodbye", "bye", "exit", "quit", "end" or other farewells or phrases.

    Returns:
        Success message confirming the conversation will end
    """
    return "Ending conversation"