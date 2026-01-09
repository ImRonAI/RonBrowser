"""Training and optimization pipeline for DSPy agent - FIXED VERSION.

FIXED ISSUES:
1. Proper DSPy optimizer usage (removed deprecated APIs)
2. Fixed metric functions to return bool for DSPy compatibility
3. Proper dataset format handling
4. Fixed distillation workflow
5. Added proper error handling
6. Fixed model configuration

Supports:
- BootstrapFewShot: Learn demonstrations from examples
- BootstrapFewShotWithRandomSearch: FewShot with candidate search
- MIPRO: Multi-step iterative prompt optimization
- Evaluation: Test set metrics and comparison

DISTILLATION WORKFLOW (SFT DATA EXPORT):
1. Run the agent with a strong "teacher" LM to generate trajectories/answers.
2. Export those runs into a JSONL dataset suitable for supervised fine-tuning.
3. Fine-tune an open-weights "student" model using your preferred infrastructure.
"""

import dspy
from dspy.teleprompt import (
    BootstrapFewShot,
    BootstrapFewShotWithRandomSearch,
    MIPRO,
)
from dspy.evaluate import Evaluate
from typing import List, Callable, Optional, Dict, Any, Union
from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)

# Enable experimental features if available
try:
    dspy.settings.experimental = True
except AttributeError:
    pass  # Not available in this version


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
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Training data not found: {path}")

    with open(path) as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("Training data must be a JSON array")

    examples = []
    for i, item in enumerate(data):
        if "request" not in item:
            logger.warning(f"Skipping example {i}: missing 'request' field")
            continue

        example = dspy.Example(
            request=item["request"],
            expected_response=item.get("expected_response", ""),
            expected_tools=item.get("expected_tools", []),
        ).with_inputs("request")
        examples.append(example)

    logger.info(f"Loaded {len(examples)} training examples from {path}")
    return examples


# FIXED: DSPy metrics must return bool for bootstrap optimizers
def task_completion_metric_bool(example: dspy.Example, pred: dspy.Prediction, trace=None) -> bool:
    """Evaluate if task was completed correctly (boolean version for DSPy).

    Checks:
    - Response contains expected content
    - Expected tools were used

    Args:
        example: Training example with expected values
        pred: Model prediction
        trace: Optional trace for debugging

    Returns:
        True if task completed successfully, False otherwise
    """
    # Check if response contains expected content
    expected = getattr(example, "expected_response", "")
    response = getattr(pred, "response", "")

    response_ok = True
    if expected:
        response_ok = expected.lower() in response.lower()

    # Check if expected tools were used
    expected_tools = set(getattr(example, "expected_tools", []))
    tool_calls = getattr(pred, "tool_calls", [])

    tools_ok = True
    if expected_tools:
        used_tools = set()
        if isinstance(tool_calls, list):
            for tc in tool_calls:
                if isinstance(tc, dict):
                    tool_name = tc.get("tool", "")
                    if tool_name:
                        used_tools.add(tool_name)

        tools_ok = expected_tools.issubset(used_tools)

    return response_ok and tools_ok


def task_completion_metric_score(example: dspy.Example, pred: dspy.Prediction, trace=None) -> float:
    """Evaluate if task was completed correctly (score version for evaluation).

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

    used_tools = set()
    if isinstance(tool_calls, list):
        for tc in tool_calls:
            if isinstance(tc, dict):
                tool_name = tc.get("tool", "")
                if tool_name:
                    used_tools.add(tool_name)

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
    errors = 0
    if isinstance(tool_calls, list):
        errors = sum(
            1 for tc in tool_calls
            if isinstance(tc, dict) and "error" in tc
        )

    if errors == 0:
        score += 0.34
    elif errors == 1:
        score += 0.17

    return score


def combined_metric_score(example: dspy.Example, pred: dspy.Prediction, trace=None) -> float:
    """Combined metric: correctness (60%) + quality (40%).

    Args:
        example: Training example
        pred: Model prediction
        trace: Optional trace

    Returns:
        Combined score between 0.0 and 1.0
    """
    correctness = task_completion_metric_score(example, pred, trace)
    quality = response_quality_metric(example, pred, trace)
    return 0.6 * correctness + 0.4 * quality


# FIXED: Proper boolean metric for DSPy optimizers
def combined_metric_bool(example: dspy.Example, pred: dspy.Prediction, trace=None) -> bool:
    """Combined metric (boolean version for DSPy optimizers).

    Args:
        example: Training example
        pred: Model prediction
        trace: Optional trace

    Returns:
        True if score > 0.5, False otherwise
    """
    score = combined_metric_score(example, pred, trace)
    return score > 0.5


# =============================================================================
# DISTILLATION PIPELINE
# =============================================================================

def distill_to_open_weights(
    agent_module: dspy.Module,
    training_data_path: str,
    output_dir: str,
    teacher_model: str = "anthropic/claude-3-opus-20240229",
    student_model: str = "meta-llama/Llama-3.1-8B-Instruct",
    num_threads: int = 4,
    metric: Optional[Callable] = None,
) -> Dict[str, Any]:
    """Distill knowledge from large model to smaller open-weights model.

    This function exports an SFT-style dataset by running the agent with a
    teacher LM and saving (request, response) pairs.

    Args:
        agent_module: The DSPy module to distill
        training_data_path: Path to training examples
        output_dir: Directory to save traces and compiled data
        teacher_model: Large model for generating traces
        student_model: Target model for distillation
        num_threads: Parallel trace generation threads (unused, kept for API)
        metric: Evaluation metric (unused, kept for API)

    Returns:
        Dict with traces_path, dataset_path, recommendations
    """
    trainset = load_training_data(training_data_path)

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Configure teacher model
    from ..config import configure_lm, get_default_lm

    # FIXED: Proper model configuration
    try:
        if "claude" in teacher_model.lower():
            teacher_lm = configure_lm(
                model=teacher_model,
                max_tokens=4096,
                temperature=0.7,
            )
        else:
            teacher_lm = get_default_lm()
    except Exception as e:
        logger.error(f"Failed to configure teacher model: {e}")
        raise

    # Run the agent with teacher LM and save runs
    teacher_runs: List[Dict[str, Any]] = []

    logger.info(f"Generating teacher runs with {teacher_model}...")
    with dspy.context(lm=teacher_lm):
        for i, example in enumerate(trainset):
            logger.info(f"Processing example {i+1}/{len(trainset)}")
            try:
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
            except Exception as e:
                logger.error(f"Failed to process example {i}: {e}")
                # Add a failed run with error info
                teacher_runs.append(
                    {
                        "request": example.request,
                        "response": f"Error: {str(e)}",
                        "reasoning": "",
                        "tool_calls": [],
                        "iterations": 0,
                        "trajectory": {},
                        "error": str(e),
                    }
                )

    # Save teacher runs
    traces_path = output_path / "teacher_runs.json"
    with open(traces_path, "w") as f:
        json.dump(teacher_runs, f, indent=2, default=str)

    # Export SFT dataset
    dataset_path = output_path / "finetune_dataset.jsonl"
    _export_sft_dataset(teacher_runs, str(dataset_path))

    # Save metadata
    metadata_path = output_path / "distillation_metadata.json"
    with open(metadata_path, "w") as f:
        json.dump({
            "teacher_model": teacher_model,
            "student_model": student_model,
            "num_examples": len(trainset),
            "num_successful": sum(1 for r in teacher_runs if "error" not in r),
            "training_data_path": str(training_data_path),
        }, f, indent=2)

    return {
        "traces_path": str(traces_path),
        "dataset_path": str(dataset_path),
        "num_traces": len(trainset),
        "num_successful": sum(1 for r in teacher_runs if "error" not in r),
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
            # Skip failed runs
            if "error" in run:
                continue

            entry = {
                "messages": [
                    {"role": "user", "content": run.get("request", "")},
                    {"role": "assistant", "content": run.get("response", "")},
                ],
                "metadata": {
                    "tool_calls": run.get("tool_calls", []),
                    "iterations": run.get("iterations", 0),
                    "reasoning": run.get("reasoning", ""),
                },
            }
            f.write(json.dumps(entry, default=str) + "\n")


def _get_finetune_recommendations(student_model: str) -> List[str]:
    """Get recommendations for finetuning the student model."""
    recommendations = []

    if "llama" in student_model.lower():
        recommendations.extend([
            "Use Hugging Face Transformers with PEFT/LoRA for efficient finetuning",
            "Recommended: QLoRA (4-bit quantization) for 8B models",
            "Tools: axolotl, LLaMA-Factory, or transformers + peft",
            "Command: python -m axolotl.cli.train finetune_config.yaml",
            "Consider using Unsloth for 2x faster training",
        ])
    elif "mistral" in student_model.lower():
        recommendations.extend([
            "Mistral models work well with instruction-following finetuning",
            "Use the same LoRA/QLoRA approach as Llama",
            "Consider Mistral 7B for balance of speed and quality",
            "Mistral models support function calling natively",
        ])
    elif "gpt" in student_model.lower():
        recommendations.extend([
            "Use OpenAI Fine-tuning API",
            "Upload dataset: openai api fine_tunes.create -t finetune_dataset.jsonl",
            "Wait for training completion (~hours)",
            "Use finetuned model ID in your application",
        ])
    else:
        recommendations.extend([
            "Convert dataset to model-specific format if needed",
            "Use appropriate finetuning framework for your model",
            "Consider using Modal, Anyscale, or RunPod for GPU access",
            "Test with smaller models first to validate pipeline",
        ])

    recommendations.extend([
        "After finetuning, update agent config to use student model for inference",
        "Run evaluation to compare teacher vs student performance",
        "Consider iterative distillation for better results",
    ])

    return recommendations


# =============================================================================
# FEW-SHOT OPTIMIZATION
# =============================================================================

def optimize_agent(
    agent_module: dspy.Module,
    training_data_path: str,
    output_path: str,
    method: str = "bootstrap",
    metric: Optional[Callable] = None,
    num_threads: int = 4,
    max_bootstrapped_demos: int = 4,
    max_labeled_demos: int = 4,
) -> dspy.Module:
    """Optimize agent using training examples.

    Args:
        agent_module: The DSPy module to optimize
        training_data_path: Path to training examples JSON
        output_path: Path to save optimized module
        method: Optimization method:
            - 'bootstrap': Standard few-shot learning
            - 'bootstrap_random': Few-shot with random search
            - 'mipro': MIPRO optimization (if available)
        metric: Evaluation metric function (must return bool for bootstrap)
        num_threads: Number of threads for parallel evaluation
        max_bootstrapped_demos: Max bootstrapped demonstrations
        max_labeled_demos: Max labeled demonstrations

    Returns:
        Optimized module
    """
    trainset = load_training_data(training_data_path)

    # FIXED: Use boolean metric for bootstrap optimizers
    metric_fn = metric or combined_metric_bool

    logger.info(f"Optimizing with method: {method}")

    if method == "bootstrap":
        optimizer = BootstrapFewShot(
            metric=metric_fn,
            max_bootstrapped_demos=max_bootstrapped_demos,
            max_labeled_demos=max_labeled_demos,
        )
    elif method == "bootstrap_random":
        optimizer = BootstrapFewShotWithRandomSearch(
            metric=metric_fn,
            max_bootstrapped_demos=max_bootstrapped_demos,
            max_labeled_demos=max_labeled_demos,
            num_candidate_programs=10,
            num_threads=num_threads,
        )
    elif method == "mipro":
        # FIXED: MIPRO configuration
        try:
            optimizer = MIPRO(
                metric=metric_fn,
                num_candidates=10,
                init_temperature=1.0,
            )
        except (ImportError, AttributeError):
            logger.warning("MIPRO not available, falling back to BootstrapFewShot")
            optimizer = BootstrapFewShot(
                metric=metric_fn,
                max_bootstrapped_demos=max_bootstrapped_demos,
                max_labeled_demos=max_labeled_demos,
            )
    else:
        raise ValueError(
            f"Unknown method: {method}. "
            "Use 'bootstrap', 'bootstrap_random', or 'mipro'."
        )

    # Compile optimized module
    logger.info("Compiling optimized module...")
    try:
        optimized = optimizer.compile(agent_module, trainset=trainset)
    except Exception as e:
        logger.error(f"Optimization failed: {e}")
        raise

    # Save to disk
    output_dir = Path(output_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)

    # FIXED: Proper save method
    try:
        optimized.save(output_path)
        logger.info(f"Saved optimized module to {output_path}")
    except AttributeError:
        # Fallback: save state dict if save method not available
        import pickle
        with open(output_path, "wb") as f:
            pickle.dump(optimized, f)
        logger.info(f"Saved optimized module (pickle) to {output_path}")

    return optimized


def evaluate_agent(
    agent_module: dspy.Module,
    test_data_path: str,
    metric: Optional[Callable] = None,
    num_threads: int = 4,
    display_progress: bool = True,
    return_outputs: bool = False,
) -> Dict[str, Any]:
    """Evaluate agent on test set.

    Args:
        agent_module: The DSPy module to evaluate
        test_data_path: Path to test examples JSON
        metric: Evaluation metric (default: combined_metric_score)
        num_threads: Number of threads for parallel evaluation
        display_progress: Show progress bar
        return_outputs: Return detailed outputs for each example

    Returns:
        Dict with score and detailed results
    """
    testset = load_training_data(test_data_path)

    # FIXED: Use score metric for evaluation
    metric_fn = metric or combined_metric_score

    evaluator = Evaluate(
        devset=testset,
        metric=metric_fn,
        num_threads=num_threads,
        display_progress=display_progress,
        return_outputs=return_outputs,
    )

    logger.info(f"Evaluating on {len(testset)} examples...")
    result = evaluator(agent_module)

    # FIXED: Handle different return types from Evaluate
    if isinstance(result, tuple):
        score, outputs = result
        return {
            "score": score,
            "num_examples": len(testset),
            "metric": metric_fn.__name__,
            "outputs": outputs if return_outputs else None,
        }
    else:
        return {
            "score": result,
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
    logger.info("Evaluating original module...")
    original_results = evaluate_agent(
        original_module, test_data_path, metric, display_progress=False
    )

    logger.info("Evaluating optimized module...")
    optimized_results = evaluate_agent(
        optimized_module, test_data_path, metric, display_progress=False
    )

    improvement = optimized_results["score"] - original_results["score"]

    return {
        "original_score": original_results["score"],
        "optimized_score": optimized_results["score"],
        "improvement": improvement,
        "improvement_percent": (improvement / max(original_results["score"], 0.01)) * 100,
        "num_examples": original_results["num_examples"],
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
    from ..config import configure_lm, get_default_lm

    results = {}
    testset = load_training_data(test_data_path)
    metric_fn = metric or combined_metric_score

    for model_config in models:
        name = model_config["name"]
        lm = model_config.get("lm")

        if lm is None:
            # Auto-configure based on name
            try:
                if "claude" in name.lower() or "anthropic" in name.lower():
                    lm = configure_lm(
                        model=f"anthropic/{name}",
                        max_tokens=4096,
                    )
                else:
                    lm = get_default_lm()
            except Exception as e:
                logger.error(f"Failed to configure model {name}: {e}")
                continue

        logger.info(f"Evaluating with model: {name}")
        with dspy.context(lm=lm):
            evaluator = Evaluate(
                devset=testset,
                metric=metric_fn,
                num_threads=4,
                display_progress=True,
            )
            score = evaluator(agent_module)

            # Handle tuple return from Evaluate
            if isinstance(score, tuple):
                score = score[0]

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