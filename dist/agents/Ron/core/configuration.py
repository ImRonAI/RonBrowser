"""BedrockModel configuration for Ron Agent with Opus 4.5 and extended thinking."""

from strands.models import BedrockModel


def create_model() -> BedrockModel:
    """Create BedrockModel configured for Claude Opus 4.5 with extended thinking.

    Returns:
        BedrockModel: Configured model instance with streaming and thinking enabled.
    """
    return BedrockModel(
        model_id="global.anthropic.claude-opus-4-5-20251101-v1:0",
        streaming=True,
        additional_request_fields={
            "thinking": {
                "type": "enabled",
                "budget_tokens": 10000,
            }
        },
    )
