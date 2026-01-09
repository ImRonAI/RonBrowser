"""DSPy Language Model configuration - FIXED VERSION.

FIXED ISSUES:
1. Proper DSPy LM initialization
2. Correct provider string format
3. Better error handling
4. Support for multiple providers
5. Proper credential checking
"""

import os
from typing import Optional
import dspy
import logging

logger = logging.getLogger(__name__)


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
    - "openai/gpt-4-turbo"
    - "anthropic/claude-3-opus-20240229"
    - "anthropic/claude-3-sonnet-20240229"
    - "together/meta-llama/Llama-3-70b-chat-hf"
    - "cohere/command-r-plus"

    Args:
        model: Provider-qualified model string (e.g., "openai/gpt-4")
        api_key: API key for the provider
        max_tokens: Maximum output tokens
        temperature: Sampling temperature
        **kwargs: Additional provider-specific parameters

    Returns:
        Configured DSPy language model

    Raises:
        ValueError: If model string is invalid
    """
    if "/" not in model:
        raise ValueError(
            f"Model string must be provider-qualified (e.g., 'openai/gpt-4'). "
            f"Got: {model}"
        )

    provider = model.split("/")[0]
    logger.info(f"Configuring DSPy LM with provider: {provider}, model: {model}")

    try:
        return dspy.LM(
            model=model,
            api_key=api_key,
            max_tokens=max_tokens,
            temperature=temperature,
            **kwargs,
        )
    except Exception as e:
        logger.error(f"Failed to configure DSPy LM: {e}")
        raise


def configure_openai_lm(
    model: str = "gpt-4-turbo",
    api_key: Optional[str] = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
    **kwargs,
) -> dspy.LM:
    """Configure DSPy with OpenAI models.

    Args:
        model: OpenAI model name (without provider prefix)
        api_key: API key (defaults to OPENAI_API_KEY env var)
        max_tokens: Maximum output tokens
        temperature: Sampling temperature
        **kwargs: Additional OpenAI-specific parameters

    Returns:
        Configured DSPy language model
    """
    api_key = api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError(
            "OpenAI API key required. Set OPENAI_API_KEY environment variable."
        )

    # Ensure model has provider prefix
    if not model.startswith("openai/"):
        model = f"openai/{model}"

    return configure_lm(
        model=model,
        api_key=api_key,
        max_tokens=max_tokens,
        temperature=temperature,
        **kwargs,
    )


def configure_anthropic_lm(
    model: str = "claude-3-sonnet-20240229",
    api_key: Optional[str] = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
    **kwargs,
) -> dspy.LM:
    """Configure DSPy with Anthropic API directly.

    Args:
        model: Anthropic model name (without provider prefix)
        api_key: API key (defaults to ANTHROPIC_API_KEY env var)
        max_tokens: Maximum output tokens
        temperature: Sampling temperature
        **kwargs: Additional Anthropic-specific parameters

    Returns:
        Configured DSPy language model
    """
    api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "Anthropic API key required. Set ANTHROPIC_API_KEY environment variable."
        )

    # Ensure model has provider prefix
    if not model.startswith("anthropic/"):
        model = f"anthropic/{model}"

    return configure_lm(
        model=model,
        api_key=api_key,
        max_tokens=max_tokens,
        temperature=temperature,
        **kwargs,
    )


def configure_bedrock_lm(
    model_id: str = "anthropic.claude-3-sonnet-20240229-v1:0",
    region: str = "us-east-1",
    max_tokens: int = 4096,
    temperature: float = 0.7,
    profile: Optional[str] = None,
) -> dspy.LM:
    """Configure DSPy for AWS Bedrock.

    NOTE: This requires a custom DSPy provider for Bedrock.
    If not available, this function will attempt fallback configuration.

    Args:
        model_id: Bedrock model identifier
        region: AWS region
        max_tokens: Maximum output tokens
        temperature: Sampling temperature
        profile: AWS profile name (optional)

    Returns:
        Configured DSPy language model

    Raises:
        RuntimeError: If Bedrock provider not available
    """
    # Check for AWS credentials
    has_aws = (
        os.getenv("AWS_ACCESS_KEY_ID") or
        os.getenv("AWS_PROFILE") or
        profile
    )

    if not has_aws:
        raise ValueError(
            "AWS credentials required for Bedrock. "
            "Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or AWS_PROFILE."
        )

    # Try to use Bedrock provider if available
    try:
        # Some DSPy installations may have bedrock provider
        return configure_lm(
            model=f"bedrock/{model_id}",
            max_tokens=max_tokens,
            temperature=temperature,
            region=region,
            profile=profile,
        )
    except Exception as e:
        logger.warning(f"Bedrock provider not available: {e}")

        # Fallback: Try to use Anthropic via Bedrock runtime
        # This requires boto3 and custom implementation
        try:
            from .bedrock_adapter import BedrockLM
            return BedrockLM(
                model_id=model_id,
                region=region,
                max_tokens=max_tokens,
                temperature=temperature,
                profile=profile,
            )
        except ImportError:
            raise RuntimeError(
                "Bedrock support not available. "
                "Use Anthropic API directly with configure_anthropic_lm() "
                "or implement custom Bedrock adapter."
            )


def configure_together_lm(
    model: str = "meta-llama/Llama-3-70b-chat-hf",
    api_key: Optional[str] = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
    **kwargs,
) -> dspy.LM:
    """Configure DSPy with Together AI for open models.

    Args:
        model: Model name on Together platform
        api_key: API key (defaults to TOGETHER_API_KEY env var)
        max_tokens: Maximum output tokens
        temperature: Sampling temperature
        **kwargs: Additional Together-specific parameters

    Returns:
        Configured DSPy language model
    """
    api_key = api_key or os.getenv("TOGETHER_API_KEY")
    if not api_key:
        raise ValueError(
            "Together API key required. Set TOGETHER_API_KEY environment variable."
        )

    # Ensure model has provider prefix
    if not model.startswith("together/"):
        model = f"together/{model}"

    return configure_lm(
        model=model,
        api_key=api_key,
        max_tokens=max_tokens,
        temperature=temperature,
        **kwargs,
    )


def configure_local_lm(
    model: str = "llama-3-8b",
    base_url: str = "http://localhost:8000",
    max_tokens: int = 4096,
    temperature: float = 0.7,
    **kwargs,
) -> dspy.LM:
    """Configure DSPy with a local model server (vLLM, TGI, etc).

    Args:
        model: Model name/path
        base_url: Local server URL
        max_tokens: Maximum output tokens
        temperature: Sampling temperature
        **kwargs: Additional parameters

    Returns:
        Configured DSPy language model
    """
    # Use OpenAI-compatible endpoint for local models
    return configure_lm(
        model=f"openai/{model}",
        api_base=base_url,
        api_key="dummy",  # Local servers often don't need real keys
        max_tokens=max_tokens,
        temperature=temperature,
        **kwargs,
    )


def get_default_lm() -> dspy.LM:
    """Get default LM based on environment.

    Priority order:
    1. OpenAI (if OPENAI_API_KEY set)
    2. Anthropic (if ANTHROPIC_API_KEY set)
    3. Together (if TOGETHER_API_KEY set)
    4. Bedrock (if AWS credentials available)
    5. Local (if localhost:8000 is accessible)

    Returns:
        Configured DSPy language model

    Raises:
        RuntimeError: If no LM credentials found
    """
    # Try OpenAI first (most common)
    if os.getenv("OPENAI_API_KEY"):
        logger.info("Using OpenAI as default LM provider")
        return configure_openai_lm()

    # Try Anthropic
    if os.getenv("ANTHROPIC_API_KEY"):
        logger.info("Using Anthropic as default LM provider")
        return configure_anthropic_lm()

    # Try Together
    if os.getenv("TOGETHER_API_KEY"):
        logger.info("Using Together as default LM provider")
        return configure_together_lm()

    # Try Bedrock
    if os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("AWS_PROFILE"):
        try:
            logger.info("Using AWS Bedrock as default LM provider")
            return configure_bedrock_lm()
        except Exception as e:
            logger.warning(f"Bedrock configuration failed: {e}")

    # Try local server
    try:
        import requests
        response = requests.get("http://localhost:8000/health", timeout=1)
        if response.ok:
            logger.info("Using local model server as default LM provider")
            return configure_local_lm()
    except Exception:
        pass

    raise RuntimeError(
        "No LM credentials found. Please set one of:\n"
        "- OPENAI_API_KEY for OpenAI\n"
        "- ANTHROPIC_API_KEY for Anthropic\n"
        "- TOGETHER_API_KEY for Together AI\n"
        "- AWS credentials for Bedrock\n"
        "- Run a local model server on port 8000"
    )


# Utility functions for model selection
def list_available_providers() -> list:
    """List available LM providers based on credentials."""
    providers = []

    if os.getenv("OPENAI_API_KEY"):
        providers.append("openai")
    if os.getenv("ANTHROPIC_API_KEY"):
        providers.append("anthropic")
    if os.getenv("TOGETHER_API_KEY"):
        providers.append("together")
    if os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("AWS_PROFILE"):
        providers.append("bedrock")

    try:
        import requests
        response = requests.get("http://localhost:8000/health", timeout=1)
        if response.ok:
            providers.append("local")
    except Exception:
        pass

    return providers


def get_recommended_model(task_type: str = "general") -> str:
    """Get recommended model for a task type.

    Args:
        task_type: Type of task (general, coding, reasoning, creative)

    Returns:
        Recommended model string
    """
    recommendations = {
        "general": [
            "openai/gpt-4-turbo",
            "anthropic/claude-3-sonnet-20240229",
            "together/meta-llama/Llama-3-70b-chat-hf",
        ],
        "coding": [
            "openai/gpt-4-turbo",
            "anthropic/claude-3-opus-20240229",
            "together/codellama/CodeLlama-34b-Instruct-hf",
        ],
        "reasoning": [
            "openai/gpt-4-turbo",
            "anthropic/claude-3-opus-20240229",
            "together/meta-llama/Llama-3-70b-chat-hf",
        ],
        "creative": [
            "anthropic/claude-3-opus-20240229",
            "openai/gpt-4-turbo",
            "together/mistralai/Mixtral-8x7B-Instruct-v0.1",
        ],
    }

    available = list_available_providers()
    task_models = recommendations.get(task_type, recommendations["general"])

    for model in task_models:
        provider = model.split("/")[0]
        if provider in available:
            return model

    # Fallback to any available
    if available:
        provider = available[0]
        if provider == "openai":
            return "openai/gpt-4-turbo"
        elif provider == "anthropic":
            return "anthropic/claude-3-sonnet-20240229"
        elif provider == "together":
            return "together/meta-llama/Llama-3-70b-chat-hf"
        elif provider == "bedrock":
            return "bedrock/anthropic.claude-3-sonnet-20240229-v1:0"
        else:
            return "openai/local-model"

    raise RuntimeError("No models available")