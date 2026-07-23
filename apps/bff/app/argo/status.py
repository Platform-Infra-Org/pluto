"""Map raw Argo Workflow JSON to a normalized status + extract the failed step.

Argo caveat [R]: a pending workflow may omit status.phase entirely until the
controller first operates on it — we treat missing phase as "Pending", not an error.
"""

from __future__ import annotations

from .models import NodeStatus, WorkflowStatus

FAILED_PHASES = {"Failed", "Error"}


def normalize_status(raw: dict) -> WorkflowStatus:
    status = raw.get("status") or {}
    name = (raw.get("metadata") or {}).get("name", "")

    nodes: dict[str, NodeStatus] = {}
    for node_id, n in (status.get("nodes") or {}).items():
        nodes[node_id] = NodeStatus(
            id=n.get("id", node_id),
            name=n.get("name", ""),
            display_name=n.get("displayName", ""),
            type=n.get("type", ""),
            phase=n.get("phase", ""),
            message=n.get("message", ""),
            children=list(n.get("children") or []),
        )

    return WorkflowStatus(
        name=name,
        phase=status.get("phase") or "Pending",  # missing phase => Pending [R caveat]
        nodes=nodes,
    )


def _has_failed_descendant(node: NodeStatus, nodes: dict[str, NodeStatus]) -> bool:
    stack = list(node.children)
    seen: set[str] = set()
    while stack:
        cid = stack.pop()
        if cid in seen:
            continue
        seen.add(cid)
        child = nodes.get(cid)
        if child is None:
            continue
        if child.phase in FAILED_PHASES:
            return True
        stack.extend(child.children)
    return False


def find_failed_step(ws: WorkflowStatus) -> NodeStatus | None:
    """Deepest failing leaf: a Failed/Error node with no failed descendant.

    Parent DAG/Steps nodes go Failed when a descendant fails, so we skip any
    failed node whose subtree still contains a failed node and return the actual
    leaf step (the pod that ran the container).
    """
    for node in ws.nodes.values():
        if node.phase in FAILED_PHASES and not _has_failed_descendant(node, ws.nodes):
            return node
    return None
