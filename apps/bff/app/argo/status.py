"""Map raw Argo Workflow JSON to a normalized status + extract the failed step.

Argo caveat [R]: a pending workflow may omit status.phase entirely until the
controller first operates on it — we treat missing phase as "Pending", not an error.
"""

from __future__ import annotations

from .models import NodeStatus, WorkflowStatus

FAILED_PHASES = {"Failed", "Error"}
# Terminal phases that mean a node did NOT ultimately fail. A Retry node in one
# of these has recovered, so its failed attempt children are stale, not failures.
NON_FAILED_TERMINAL_PHASES = {"Succeeded", "Skipped", "Omitted"}


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
            finished_at=n.get("finishedAt") or None,
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


def _recovered_retry_attempt(node_id: str, nodes: dict[str, NodeStatus]) -> bool:
    """True if node_id sits under a Retry ancestor that ultimately did NOT fail.

    Argo keeps the failed attempt node at phase=Failed even after a retry
    succeeds; it hangs under a Retry-type node whose own phase is Succeeded. Such
    an attempt recovered and must not be reported as the failure.
    """
    parent: dict[str, str] = {}
    for pid, n in nodes.items():
        for cid in n.children:
            parent.setdefault(cid, pid)  # first parent wins (attempts have one)

    seen: set[str] = set()
    cur = parent.get(node_id)
    while cur is not None and cur not in seen:
        seen.add(cur)
        anc = nodes.get(cur)
        if anc is None:
            break
        if anc.type == "Retry" and anc.phase in NON_FAILED_TERMINAL_PHASES:
            return True
        cur = parent.get(cur)
    return False


def find_failed_step(ws: WorkflowStatus) -> NodeStatus | None:
    """The failing leaf step to report to the user.

    A failing leaf is a Failed/Error node with no failed descendant (parent
    DAG/Steps nodes go Failed when a descendant fails, so they are skipped).

    Two corrections for accuracy:
    - Exclude stale failed *attempts* that recovered on retry (a Failed node
      under a Retry ancestor that ultimately Succeeded).
    - Among genuinely-failing leaves, pick deterministically: earliest
      finished_at (the root-causiest failure), tiebreaking by node id. Map order
      is not stable in Argo, so we never rely on it.
    """
    candidates = [
        node
        for node in ws.nodes.values()
        if node.phase in FAILED_PHASES
        and not _has_failed_descendant(node, ws.nodes)
        and not _recovered_retry_attempt(node.id, ws.nodes)
    ]
    if not candidates:
        return None
    # Nodes without a finish time sort last (still deterministic via id tiebreak).
    return min(candidates, key=lambda n: (n.finished_at is None, n.finished_at or "", n.id))
