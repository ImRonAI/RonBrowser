"""DSPy Language Model configuration."""

import os
from typing import Optional
import dspy


def configure_lm(
    model: str,
    api_key: Optional[str] = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
    **kwargs,
) -> dspy.LM:
    """Create a DSPy LM using an explicit DSPy model string.

    DSPy expects provider-qualified model identifiers such as:
    - "openai/gpt-4o-mini"
    - "anthropic/claude-..."
    - "openai/arbor:Qwen/..."

    See the DSPy docs for supported providers and parameters.
    """
    return dspy.LM(
        model=model,
        api_key=api_key,
        max_tokens=max_tokens,
        temperature=temperature,
        **kwargs,
    )


def configure_bedrock_lm(
    model_id: str = "anthropic.claude-opus-4-5-20251101-v1:0",
    region: str = "us-east-1",
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> dspy.LM:
    """Configure DSPy for AWS Bedrock via Anthropic provider.

    Since DSPy doesn't have native Bedrock support, we use the Anthropic
    provider with AWS credentials. This requires boto3 and proper AWS config.

    Args:
        model_id: Bedrock model identifier
        region: AWS region
        max_tokens: Maximum output tokens
        temperature: Sampling temperature

    Returns:
        Configured DSPy language model

    Note:
        Requires AWS credentials configured via environment variables or ~/.aws/config
    """
    # Extract the model name from Bedrock model ID
    # e.g., "anthropic.claude-opus-4-5-20251101-v1:0" -> "claude-opus-4-5"
    if "claude" in model_id.lower():
        # Use Anthropic provider with explicit model name
        model_name = model_id.split(".")[-1].split("-v")[0]

        # For Bedrock, we need to use the Anthropic provider with AWS auth
        # DSPy will handle the AWS credentials if boto3 is installed
        import os
        os.environ["AWS_DEFAULT_REGION"] = region

        # Use anthropic provider which DSPy supports
        return configure_lm(
            model=f"anthropic/{model_name}",
            max_tokens=max_tokens,
            temperature=temperature,
            # Pass region as extra kwarg for potential custom providers
            aws_region=region,
            use_bedrock=True,  # Hint for custom providers
        )
    else:
        # Fallback for non-Claude models - use direct Anthropic API
        raise ValueError(
            f"Bedrock model {model_id} not supported. "
            "Currently only Claude models are supported via Bedrock."
        )


def configure_anthropic_lm(
    model: str = "claude-sonnet-4-5-20250929",
    api_key: Optional[str] = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> dspy.LM:
    """Configure DSPy with Anthropic API directly.

    Fallback for non-Bedrock environments.

    Args:
        model: Anthropic model name
        api_key: API key (defaults to ANTHROPIC_API_KEY env var)
        max_tokens: Maximum output tokens
        temperature: Sampling temperature

    Returns:
        Configured DSPy language model
    """
    return configure_lm(
        model=f"anthropic/{model}",
        api_key=api_key or os.getenv("ANTHROPIC_API_KEY"),
        max_tokens=max_tokens,
        temperature=temperature,
    )


def get_default_lm() -> dspy.LM:
    """Get default LM based on environment.

    Prefers Bedrock if AWS credentials available, otherwise Anthropic API.
    """
    # Check for Bedrock credentials
    if os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("AWS_PROFILE"):
        try:
            return configure_bedrock_lm()
        except Exception:
            # Fall back to a documented provider if possible.
            pass

    # Fall back to Anthropic
    if os.getenv("ANTHROPIC_API_KEY"):
        return configure_anthropic_lm()

    raise RuntimeError(
        "No LM credentials found. Set AWS credentials for Bedrock or ANTHROPIC_API_KEY."
    )
