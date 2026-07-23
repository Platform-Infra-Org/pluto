"""Normalized Argo workflow types. Kept as plain dataclasses — the raw Argo
JSON is huge and mostly irrelevant; we only surface what the BFF needs."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class WorkflowRef:
    """Identifies a submitted workflow. Stored on the Request as workflow_ref."""

    namespace: str
    name: str


@dataclass
class NodeStatus:
    """One node (step) of a workflow, from status.nodes."""

    id: str
    name: str
    display_name: str
    type: str
    phase: str
    message: str
    finished_at: str | None = None
    children: list[str] = field(default_factory=list)


@dataclass
class WorkflowStatus:
    name: str
    phase: str
    nodes: dict[str, NodeStatus] = field(default_factory=dict)
