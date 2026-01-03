"""Training and optimization pipeline for DSPy agent.

Supports:
- BootstrapFinetune: Teacher-student distillation to smaller models
- BootstrapFewShot: Learn demonstrations from examples
- BootstrapFewShotWithRandomSearch: FewShot with candidate search
- MIPRO: Multi-step iterative prompt optimization
- Evaluation: Test set metrics and comparison

DISTILLATION WORKFLOW (SFT DATA EXPORT):
1. Run the agent with a strong "teacher" LM to generate trajectories/answers.
2. Export those runs into a JSONL dataset suitable for supervised fine-tuning.
3. Fine-tune an open-weights "student" model using your preferred infra.

This enables running a high-performance agent on smaller, cheaper,
self-hosted open-weights models.
"""

import dspy
from dspy.teleprompt import (
    BootstrapFewShot,
    BootstrapFewShotWithRandomSearch,
)
from dspy.evaluate import Evaluate

# BootstrapFinetune is not available in all DSPy versions
try:
    from dspy.teleprompt import BootstrapFinetune
except ImportError:
    BootstrapFinetune = None
from typing import List, Callable, Optional, Dict, Any
from pathlib import Path
import json

# Some DSPy features are gated behind this flag in certain releases.
# Keep this on for compatibility with optimizers that may require it.
dspy.settings.experimental = True


def load_training_data(path: str) -> List[dspy.Example]:
    """Load training examples from JSON file.

    Expected format:
    [
        {
            "request": "User request text",
            "expected_response": "Expected response substring",
            "expected_tools": ["tool1", "tool2"]  // optional
        }
    ]

    Args:
        path: Path to JSON file with training examples

    Returns:
        List of dspy.Example objects
    """
    with open(path) as f:
        data = json.load(f)

    examples = []
    for item in data:
        example = dspy.Example(
            request=item["request"],
            expected_response=item.get("expected_response", ""),
            expected_tools=item.get("expected_tools", []),
        ).with_inputs("request")
        examples.append(example)

    return examples


def task_completion_metric(example: dspy.Example, pred: dspy.Prediction, trace=None) -> float:
    """Evaluate if task was completed correctly.

    Scoring:
    - 0.5 points: Response contains expected content
    - 0.5 points: Expected tools were used (proportional)

    Args:
        example: Training example with expected values
        pred: Model prediction
        trace: Optional trace for debugging

    Returns:
        Score between 0.0 and 1.0
    """
    score = 0.0

    # Check if response contains expected content
    expected = getattr(example, "expected_response", "")
    response = getattr(pred, "response", "")

    if expected and expected.lower() in response.lower():
        score += 0.5
    elif not expected:
        # No expected response means any response is fine
        score += 0.5

    # Check if expected tools were used
    expected_tools = set(getattr(example, "expected_tools", []))
    tool_calls = getattr(pred, "tool_calls", [])
    used_tools = {tc.get("tool", "") for tc in tool_calls if isinstance(tc, dict)}

    if expected_tools:
        if expected_tools.issubset(used_tools):
            score += 0.5
        else:
            # Partial credit for partial tool overlap
            overlap = len(expected_tools & used_tools)
            score += 0.5 * (overlap / len(expected_tools))
    else:
        # No expected tools means full credit
        score += 0.5

    return score


def response_quality_metric(example: dspy.Example, pred: dspy.Prediction, trace=None) -> float:
    """Evaluate response quality beyond just correctness.

    Checks:
    - Response length (not too short or too long)
    - Tool usage efficiency (fewer iterations is better)
    - Error handling (no errors is better)

    Args:
        example: Training example
        pred: Model prediction
        trace: Optional trace

    Returns:
        Quality score between 0.0 and 1.0
    """
    score = 0.0
    response = getattr(pred, "response", "")
    iterations = getattr(pred, "iterations", 10)
    tool_calls = getattr(pred, "tool_calls", [])

    # Response length (10-500 chars is ideal)
    if 10 <= len(response) <= 500:
        score += 0.33
    elif len(response) > 500:
        score += 0.2  # Too verbose but still ok
    elif len(response) > 0:
        score += 0.1  # Too short

    # Efficiency (fewer iterations is better)
    if iterations <= 3:
        score += 0.33
    elif iterations <= 5:
        score += 0.25
    elif iterations <= 7:
        score += 0.15

    # Error handling
    errors = sum(1 for tc in tool_calls if isinstance(tc, dict) and "error" in tc)
    if errors == 0:
        score += 0.34
    elif errors == 1:
        score += 0.17

    return score


def combined_metric(example: dspy.Example, pred: dspy.Prediction, trace=None) -> float:
    """Combined metric: correctness (60%) + quality (40%).

    Args:
        example: Training example
        pred: Model prediction
        trace: Optional trace

    Returns:
        Combined score between 0.0 and 1.0
    """
    correctness = task_completion_metric(example, pred, trace)
    quality = response_quality_metric(example, pred, trace)
    return 0.6 * correctness + 0.4 * quality


# =============================================================================
# DISTILLATION PIPELINE (BootstrapFinetune)
# =============================================================================

def distill_to_open_weights(
    agent_module: dspy.Module,
    training_data_path: str,
    output_dir: str,
    teacher_model: str = "claude-opus-4-5-20250929",
    student_model: str = "meta-llama/Llama-3.1-8B-Instruct",
    num_threads: int = 4,
    metric: Optional[Callable] = None,
) -> Dict[str, Any]:
    """Distill knowledge from large model to smaller open-weights model.

    This function exports an SFT-style dataset by *running* the agent with a
    teacher LM and saving the observed tool trajectory + final response.

    The actual finetuning step depends on your infrastructure:
    - Hugging Face Transformers + PEFT/LoRA
    - OpenAI fine-tuning API
    - AWS Bedrock custom model import
    - Modal, Anyscale, or other finetuning services

    Args:
        agent_module: The DSPy module to distill
        training_data_path: Path to training examples
        output_dir: Directory to save traces and compiled data
        teacher_model: Large model for generating traces
        student_model: Target model for distillation
        num_threads: Parallel trace generation threads
        metric: Evaluation metric

    Returns:
        Dict with:
        - traces_path: Path to generated teacher runs (JSON)
        - dataset_path: Path to exported SFT dataset (JSONL)
        - num_traces: Number of examples exported
        - recommendations: Next steps for finetuning
    """
    trainset = load_training_data(training_data_path)
    _ = metric  # metric is not used in dataset export; kept for API stability.
    _ = num_threads  # dataset export is sequential; kept for API stability.

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Configure teacher model
    from ..config import configure_anthropic_lm, configure_bedrock_lm

    # Try Anthropic direct first, fall back to Bedrock
    try:
        teacher_lm = configure_anthropic_lm(model=teacher_model)
    except Exception:
        teacher_lm = configure_bedrock_lm()

    # Run the agent with teacher LM and save runs.
    teacher_runs: List[Dict[str, Any]] = []
    with dspy.context(lm=teacher_lm):
        for example in trainset:
            pred = agent_module(request=example.request)
            teacher_runs.append(
                {
                    "request": example.request,
                    "response": getattr(pred, "response", ""),
                    "reasoning": getattr(pred, "reasoning", ""),
                    "tool_calls": getattr(pred, "tool_calls", []),
                    "iterations": getattr(pred, "iterations", 0),
                    "trajectory": getattr(pred, "trajectory", {}),
                }
            )

    # Save teacher runs
    traces_path = output_path / "teacher_runs.json"
    with open(traces_path, "w") as f:
        json.dump(teacher_runs, f, indent=2)

    # Export SFT dataset
    dataset_path = output_path / "finetune_dataset.jsonl"
    _export_sft_dataset(teacher_runs, str(dataset_path))

    return {
        "traces_path": str(traces_path),
        "dataset_path": str(dataset_path),
        "num_traces": len(trainset),
        "teacher_model": teacher_model,
        "student_model": student_model,
        "recommendations": _get_finetune_recommendations(student_model),
    }


def _export_sft_dataset(teacher_runs: List[Dict[str, Any]], output_path: str) -> None:
    """Export teacher runs as JSONL suitable for supervised fine-tuning (SFT).

    Each line contains:
    - messages: [{role:user, content}, {role:assistant, content}]
    - metadata: optional extra information (tool_calls, iterations)
    """
    with open(output_path, "w") as f:
        for run in teacher_runs:
            entry = {
                "messages": [
                    {"role": "user", "content": run.get("request", "")},
                    {"role": "assistant", "content": run.get("response", "")},
                ],
                "metadata": {
                    "tool_calls": run.get("tool_calls", []),
                    "iterations": run.get("iterations", 0),
                },
            }
            f.write(json.dumps(entry) + "\n")


def _get_finetune_recommendations(student_model: str) -> List[str]:
    """Get recommendations for finetuning the student model.

    Args:
        student_model: Target model name

    Returns:
        List of recommendation strings
    """
    recommendations = []

    if "llama" in student_model.lower():
        recommendations.extend([
            "Use Hugging Face Transformers with PEFT/LoRA for efficient finetuning",
            "Recommended: QLoRA (4-bit quantization) for 8B models",
            "Tools: axolotl, LLaMA-Factory, or transformers + peft",
            f"Command: `python -m axolotl.cli.train finetune_config.yaml`",
        ])
    elif "mistral" in student_model.lower():
        recommendations.extend([
            "Mistral models work well with instruction-following finetuning",
            "Use the same LoRA/QLoRA approach as Llama",
            "Consider Mistral 7B for balance of speed and quality",
        ])
    elif "gpt" in student_model.lower():
        recommendations.extend([
            "Use OpenAI Fine-tuning API",
            "Upload dataset: `openai api fine_tunes.create -t finetune_dataset.jsonl`",
            "Wait for training completion (~hours)",
            "Use finetuned model ID in your application",
        ])
    else:
        recommendations.extend([
            "Convert dataset to model-specific format if needed",
            "Use appropriate finetuning framework for your model",
            "Consider using Modal, Anyscale, or RunPod for GPU access",
        ])

    recommendations.append(
        "After finetuning, update agent config to use student model for inference"
    )

    return recommendations


# =============================================================================
# FEW-SHOT OPTIMIZATION (Alternative to Distillation)
# =============================================================================

def optimize_agent(
    agent_module: dspy.Module,
    training_data_path: str,
    output_path: str,
    method: str = "bootstrap_finetune",
    metric: Optional[Callable] = None,
    num_threads: int = 4,
) -> dspy.Module:
    """Optimize agent using training examples.

    Args:
        agent_module: The DSPy module to optimize
        training_data_path: Path to training examples JSON
        output_path: Path to save optimized module
        method: Optimization method:
            - 'bootstrap_finetune': Distillation (recommended for open-weights)
            - 'bootstrap': Standard few-shot learning
            - 'bootstrap_random': Few-shot with random search
        metric: Evaluation metric function (default: combined_metric)
        num_threads: Number of threads for parallel evaluation

    Returns:
        Optimized module
    """
    trainset = load_training_data(training_data_path)
    metric_fn = metric or combined_metric

    if method == "bootstrap_finetune":
        if BootstrapFinetune is None:
            # Fallback to BootstrapFewShot if BootstrapFinetune not available
            print("Warning: BootstrapFinetune not available, using BootstrapFewShot instead")
            optimizer = BootstrapFewShot(
                metric=metric_fn,
                max_bootstrapped_demos=8,
                max_labeled_demos=4,
            )
        else:
            optimizer = BootstrapFinetune(
                metric=metric_fn,
                num_threads=num_threads,
            )
    elif method == "bootstrap":
        optimizer = BootstrapFewShot(
            metric=metric_fn,
            max_bootstrapped_demos=4,
            max_labeled_demos=4,
        )
    elif method == "bootstrap_random":
        optimizer = BootstrapFewShotWithRandomSearch(
            metric=metric_fn,
            max_bootstrapped_demos=4,
            max_labeled_demos=4,
            num_candidate_programs=10,
            num_threads=num_threads,
        )
    else:
        raise ValueError(
            f"Unknown method: {method}. "
            "Use 'bootstrap_finetune', 'bootstrap', or 'bootstrap_random'."
        )

    # Compile optimized module
    optimized = optimizer.compile(agent_module, trainset=trainset)

    # Save to disk
    output_dir = Path(output_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)
    optimized.save(output_path)

    return optimized


def evaluate_agent(
    agent_module: dspy.Module,
    test_data_path: str,
    metric: Optional[Callable] = None,
    num_threads: int = 4,
    display_progress: bool = True,
) -> Dict[str, Any]:
    """Evaluate agent on test set.

    Args:
        agent_module: The DSPy module to evaluate
        test_data_path: Path to test examples JSON
        metric: Evaluation metric (default: combined_metric)
        num_threads: Number of threads for parallel evaluation
        display_progress: Show progress bar

    Returns:
        Dict with score and detailed results
    """
    testset = load_training_data(test_data_path)
    metric_fn = metric or combined_metric

    evaluator = Evaluate(
        devset=testset,
        metric=metric_fn,
        num_threads=num_threads,
        display_progress=display_progress,
    )

    score = evaluator(agent_module)

    return {
        "score": score,
        "num_examples": len(testset),
        "metric": metric_fn.__name__,
    }


def compare_agents(
    original_module: dspy.Module,
    optimized_module: dspy.Module,
    test_data_path: str,
    metric: Optional[Callable] = None,
) -> Dict[str, Any]:
    """Compare original and optimized agents.

    Args:
        original_module: Original unoptimized module
        optimized_module: Optimized module
        test_data_path: Path to test examples
        metric: Evaluation metric

    Returns:
        Comparison results
    """
    original_results = evaluate_agent(
        original_module, test_data_path, metric, display_progress=False
    )
    optimized_results = evaluate_agent(
        optimized_module, test_data_path, metric, display_progress=False
    )

    improvement = optimized_results["score"] - original_results["score"]

    return {
        "original_score": original_results["score"],
        "optimized_score": optimized_results["score"],
        "improvement": improvement,
        "improvement_percent": (improvement / max(original_results["score"], 0.01)) * 100,
    }


def compare_models(
    agent_module: dspy.Module,
    test_data_path: str,
    models: List[Dict[str, Any]],
    metric: Optional[Callable] = None,
) -> Dict[str, Any]:
    """Compare agent performance across different models.

    Useful for evaluating distillation results - compare teacher vs student.

    Args:
        agent_module: Agent module to evaluate
        test_data_path: Test data path
        models: List of model configs [{name, lm}, ...]
        metric: Evaluation metric

    Returns:
        Comparison results for each model
    """
    from ..config import configure_bedrock_lm, configure_anthropic_lm

    results = {}
    testset = load_training_data(test_data_path)
    metric_fn = metric or combined_metric

    for model_config in models:
        name = model_config["name"]
        lm = model_config.get("lm")

        if lm is None:
            # Auto-configure based on name
            if "claude" in name.lower():
                lm = configure_anthropic_lm(model=name)
            else:
                lm = configure_bedrock_lm()

        with dspy.context(lm=lm):
            evaluator = Evaluate(
                devset=testset,
                metric=metric_fn,
                num_threads=4,
                display_progress=True,
            )
            score = evaluator(agent_module)

        results[name] = {
            "score": score,
            "num_examples": len(testset),
        }

    # Calculate relative performance
    if len(results) >= 2:
        scores = list(results.values())
        best_score = max(s["score"] for s in scores)
        for name, data in results.items():
            data["relative_to_best"] = data["score"] / best_score if best_score > 0 else 0

    return results
