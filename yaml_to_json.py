#!/usr/bin/env python3
"""
Convert Telnyx.yml to JSON format.
"""

import json
import yaml
from pathlib import Path


def convert_yaml_to_json(yaml_path: str, json_path: str = None) -> None:
    """
    Convert a YAML file to JSON format.
    
    Args:
        yaml_path: Path to the input YAML file
        json_path: Path to the output JSON file (defaults to same name with .json extension)
    """
    yaml_file = Path(yaml_path)
    
    if not yaml_file.exists():
        raise FileNotFoundError(f"YAML file not found: {yaml_path}")
    
    # Default output path: same directory, same name, .json extension
    if json_path is None:
        json_path = yaml_file.with_suffix('.json')
    
    print(f"Reading YAML from: {yaml_file}")
    
    # Read and parse the YAML file
    with open(yaml_file, 'r', encoding='utf-8') as f:
        yaml_content = yaml.safe_load(f)
    
    print(f"Writing JSON to: {json_path}")
    
    # Write the JSON file with proper formatting
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(yaml_content, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully converted {yaml_file.name} to {Path(json_path).name}")


if __name__ == "__main__":
    # Convert Telnyx.yml to Telnyx.json
    yaml_file = Path(__file__).parent / "agent/tools/src/strands_tools/open-api-specs/Telnyx.yml"
    
    convert_yaml_to_json(str(yaml_file))
