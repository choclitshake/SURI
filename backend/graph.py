"""
Prerequisite Learning Graph for SURI.

This is the single source of truth for all traversal, routing, and node lookups.
Nothing else in the system should hardcode node relationships.
"""

GRAPH = {
    "QE": {
        "label": "Quadratic Equations",
        "grade": 9,
        "chains": ["chain1"],
        "prerequisite": "FP",
        "dependents": []
    },
    "FP": {
        "label": "Factoring Polynomials",
        "grade": 8,
        "chains": ["chain1", "chain4"],
        "prerequisite": "SP",
        "dependents": ["QE"]
    },
    "SP": {
        "label": "Special Products / Polynomial Multiplication",
        "grade": 7,
        "chains": ["chain1"],
        "prerequisite": "LE",
        "dependents": ["FP"]
    },
    "LE": {
        "label": "Laws of Exponents",
        "grade": 7,
        "chains": ["chain1", "chain3"],
        "prerequisite": "OI",
        "dependents": ["SP", "RER"]
    },
    "OI": {
        "label": "Operations on Integers",
        "grade": 7,
        "chains": ["chain1", "chain3"],
        "prerequisite": "FD",
        "dependents": ["LE"]
    },
    "FD": {
        "label": "Fractions & Decimals",
        "grade": 6,
        "chains": ["chain1", "chain2"],
        "prerequisite": None,
        "dependents": ["OI", "RPP"]
    },
    "SLE": {
        "label": "Systems of Linear Equations",
        "grade": 8,
        "chains": ["chain2"],
        "prerequisite": "L2V",
        "dependents": []
    },
    "L2V": {
        "label": "Linear Equations in 2 Variables",
        "grade": 8,
        "chains": ["chain2"],
        "prerequisite": "L1V",
        "dependents": ["SLE"]
    },
    "L1V": {
        "label": "Linear Equations in 1 Variable",
        "grade": 7,
        "chains": ["chain2"],
        "prerequisite": "AE",
        "dependents": ["L2V"]
    },
    "AE": {
        "label": "Algebraic Expressions & Evaluation",
        "grade": 7,
        "chains": ["chain2"],
        "prerequisite": "RPP",
        "dependents": ["L1V"]
    },
    "RPP": {
        "label": "Ratio, Proportion, Percent",
        "grade": 6,
        "chains": ["chain2"],
        "prerequisite": "FD",
        "dependents": ["AE"]
    },
    "RER": {
        "label": "Rational Exponents & Radicals",
        "grade": 9,
        "chains": ["chain3"],
        "prerequisite": "LE",
        "dependents": []
    },
    "PE": {
        "label": "Polynomial Equations",
        "grade": 10,
        "chains": ["chain4"],
        "prerequisite": "PO",
        "dependents": []
    },
    "PD": {
        "label": "Polynomial Division",
        "grade": 10,
        "chains": ["chain4"],
        "prerequisite": "PO",
        "dependents": []
    },
    "PO": {
        "label": "Polynomial Operations",
        "grade": 8,
        "chains": ["chain4"],
        "prerequisite": None,
        "dependents": ["PE", "PD"]
    }
}

ENTRY_NODES = ["SLE", "RER", "QE", "PE"]

DEEPEST_NODES = [node_id for node_id, node in GRAPH.items() if node["prerequisite"] is None]


def get_prerequisite(node_id: str):
    """Returns the prerequisite node ID for a given node, or None."""
    return GRAPH[node_id]["prerequisite"]


def get_prerequisite_path(start_node_id: str, entry_node_id: str) -> list:
    """
    Returns the path of node IDs from start_node_id upward toward entry_node_id.
    """
    path = []
    current = start_node_id
    while current is not None:
        path.append(current)
        if current == entry_node_id:
            break
        found_dependent = None
        for nid, node in GRAPH.items():
            if node["prerequisite"] == current and nid in [
                n for n in GRAPH if GRAPH[n].get("prerequisite") == current
            ]:
                pass
        for nid, node in GRAPH.items():
            if node["prerequisite"] == current:
                if entry_node_id in _get_chain_nodes(nid, entry_node_id):
                    found_dependent = nid
                    break
        current = found_dependent
    return path


def _get_chain_nodes(node_id: str, target: str) -> list:
    """Walk dependents from node_id, collecting visited nodes until target is found."""
    visited = []
    current = node_id
    while current:
        visited.append(current)
        if current == target:
            break
        dependents = GRAPH[current]["dependents"]
        if not dependents:
            break
        current = dependents[0]
    return visited


def get_next_node_toward_entry(current_node_id: str, entry_node_id: str):
    """Returns the node one step closer to the entry node from current_node_id."""
    path = get_prerequisite_path(entry_node_id, entry_node_id)
    current = entry_node_id
    while current:
        prereq = GRAPH[current]["prerequisite"]
        if prereq == current_node_id:
            return current
        current = prereq
    return None


def node_leads_to_entry(node_id: str, entry_node_id: str) -> bool:
    """True if entry_node_id is reachable from node_id by following dependents."""
    if node_id == entry_node_id:
        return True
    for dependent_id in GRAPH[node_id]["dependents"]:
        if node_leads_to_entry(dependent_id, entry_node_id):
            return True
    return False


def find_next_node_toward_entry(current_node_id: str, entry_node_id: str):
    """
    Return the dependent of current_node_id on the path toward entry_node_id,
    or None if current is already the entry node or no valid dependent exists.
    """
    if current_node_id == entry_node_id:
        return None

    candidates = [
        dep_id
        for dep_id in GRAPH[current_node_id]["dependents"]
        if node_leads_to_entry(dep_id, entry_node_id)
    ]
    if not candidates:
        return None

    entry_chains = set(GRAPH[entry_node_id]["chains"])
    for dep_id in candidates:
        if entry_chains.intersection(GRAPH[dep_id]["chains"]):
            return dep_id
    return candidates[0]
