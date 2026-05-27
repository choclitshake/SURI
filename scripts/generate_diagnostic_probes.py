import os
import json
import asyncio
import re
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.graph import GRAPH

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    print("Error: GEMINI_API_KEY not set.")
    exit(1)

client = genai.Client(api_key=API_KEY)

PROMPT_TEMPLATE = """\
You are an expert mathematics teacher writing a diagnostic quiz for Filipino Grade 9 to Grade 10 students under the K-12 curriculum.

Generate exactly 16 distinct multiple-choice questions to assess a student's mastery of: {node_label} (Grade {grade}).

STRICT REQUIREMENTS:
- Each question must clearly test '{node_label}' at a Grade 9 to Grade 10 difficulty level.
- Use straightforward, clear language appropriate for Filipino high school students.
- Each question has exactly 4 answer choices. Only one is correct.
- Vary the difficulty across the 16 questions (some easy, some medium, some hard).
- MATH FORMATTING: Wrap ALL mathematical expressions, variables, numbers, and equations in single dollar signs for inline KaTeX rendering. Examples:
    - Variables: $x$, $y$, $a$
    - Expressions: $x^2 - 5x + 6$, $3x + 2$
    - Equations: $x^2 + 4x + 4 = 0$
    - Fractions: $\\frac{{3}}{{4}}$
    - Radicals: $\\sqrt{{50}}$, $\\sqrt[3]{{8}}$
    - Exponents: $x^{{3/2}}$, $2^{{10}}$
  Plain English words (e.g., "Solve for", "What is") must NOT be wrapped in dollars.
- Distractors must be plausible (common student mistakes), not obviously wrong.
- All 16 questions must be distinct from each other.

Return ONLY a raw JSON array of exactly 16 objects. Do not include any explanation, commentary, markdown, or code fences.
Each object must have exactly these keys:
  "node_id": "{node_id}"
  "question_text": <string — use $...$ for all math>
  "options": [<string — use $...$ for math>, ...]
  "correct_option_index": <integer 0-3>

Example of a single object (do not copy this exact question):
{{"node_id": "{node_id}", "question_text": "Solve for $x$: $2x + 3 = 7$", "options": ["$x = 1$", "$x = 2$", "$x = 3$", "$x = 5$"], "correct_option_index": 1}}

Output the JSON array now:"""


def parse_response(text: str) -> list:
    """Robustly extract a JSON array from a model response."""
    if text is None:
        return []
    text = text.strip()
    # Strip markdown code fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try to extract the first JSON array
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return []


async def generate_for_node(node_id, node, retries=3) -> tuple[str, list]:
    print(f"  Generating for {node_id}: {node['label']}...")
    prompt = PROMPT_TEMPLATE.format(
        node_id=node_id,
        node_label=node['label'],
        grade=node['grade']
    )

    for attempt in range(1, retries + 1):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model='gemini-3.1-flash-lite',
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.8,
                    max_output_tokens=8192,
                ),
            )
            # Safely get text — response.text may be None on safety blocks
            raw_text = None
            try:
                raw_text = response.text
            except Exception:
                pass

            if not raw_text:
                print(f"    Attempt {attempt}: empty/blocked response for {node_id}. Retrying...")
                await asyncio.sleep(8)
                continue

            probes = parse_response(raw_text)
            if not probes:
                print(f"    Attempt {attempt}: could not parse JSON for {node_id}. Retrying...")
                await asyncio.sleep(8)
                continue

            if len(probes) != 16:
                print(f"    Warning: Expected 16 probes for {node_id}, got {len(probes)}.")

            # Ensure node_id is stamped correctly
            for p in probes:
                p["node_id"] = node_id

            print(f"    OK: {len(probes)} probes for {node_id}.")
            return node_id, probes

        except Exception as e:
            print(f"    Attempt {attempt} error for {node_id}: {e}")
            if attempt < retries:
                await asyncio.sleep(10)

    print(f"  FAILED after {retries} attempts for {node_id}. Skipping.")
    return node_id, []


async def main():
    # Load existing probes if partial run already happened
    out_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "backend", "data", "diagnostic_probes.json"
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    if os.path.exists(out_path):
        with open(out_path, "r", encoding="utf-8") as f:
            try:
                all_probes = json.load(f)
                print(f"Loaded existing probes for nodes: {list(all_probes.keys())}")
            except Exception:
                all_probes = {}
    else:
        all_probes = {}

    nodes_to_process = [
        (node_id, node)
        for node_id, node in GRAPH.items()
        if node_id != "root" and len(all_probes.get(node_id, [])) < 16
    ]

    print(f"Nodes to generate: {[n for n, _ in nodes_to_process]}")
    print(f"Total: {len(nodes_to_process)} nodes. ~{len(nodes_to_process) * 7 / 60:.1f} minutes at 8 RPM.\n")

    for i, (node_id, node) in enumerate(nodes_to_process):
        _, probes = await generate_for_node(node_id, node)
        if probes:
            all_probes[node_id] = probes

        # Save after each node in case of interruption
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(all_probes, f, indent=2)
        print(f"  Saved progress ({i + 1}/{len(nodes_to_process)} nodes done).")

        # ~7s sleep → ~8.5 RPM
        if i < len(nodes_to_process) - 1:
            print("  Sleeping 7s...")
            await asyncio.sleep(7)

    # Final summary
    print("\n=== Generation Complete ===")
    for nid, probes in all_probes.items():
        status = f"{len(probes)} probes" if probes else "MISSING"
        print(f"  {nid}: {status}")
    print(f"\nOutput: {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
