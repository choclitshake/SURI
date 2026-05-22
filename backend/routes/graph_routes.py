from fastapi import APIRouter, HTTPException
from backend.graph import GRAPH
from backend.competency_utils import get_chain

router = APIRouter(prefix="/api/graph", tags=["graph"])

@router.get("/{topic_entry_node}/chain")
async def get_graph_chain(topic_entry_node: str):
    """Return the chain preview for a topic."""
    if topic_entry_node not in GRAPH:
        raise HTTPException(status_code=404, detail="Topic not found")
        
    chain = get_chain(topic_entry_node)
    
    chain_data = []
    for node_id in chain:
        node = GRAPH[node_id]
        chain_data.append({
            "node_id": node_id,
            "node_label": node["label"],
            "grade": node["grade"]
        })
        
    return {
        "topic_entry_node": topic_entry_node,
        "chain": chain_data
    }
