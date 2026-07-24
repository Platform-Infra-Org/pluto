"""Approval policy: resolution + evaluation (Task 2a).

Policy is per-resource and data-driven — resource types are never hardcoded.
Resolve per request: resource `metadata.approvalPolicy` override -> Service
Definition default. Definitions come from E08; until then a config/stub lookup.
"""

from collections.abc import Iterable
from dataclasses import dataclass

SINGLE = "SINGLE"
N_OF_M = "N_OF_M"
RBAC = "RBAC"


@dataclass(frozen=True)
class ApprovalPolicy:
    mode: str
    n: int | None = None

    def as_dict(self) -> dict:
        d: dict = {"mode": self.mode}
        if self.n is not None:
            d["n"] = self.n
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "ApprovalPolicy":
        return cls(mode=d["mode"], n=d.get("n"))


# Convenience constructor used across tests/callers.
P = ApprovalPolicy


def definition_default(resource_type: str) -> ApprovalPolicy:
    """E08 SEAM: the Service Definition's default approval policy.

    Service Definitions (E08) are not built yet, so every type defaults to
    SINGLE. When E08 lands, look the definition up by `resource_type` here.
    ponytail: config stub, not a real lookup — replace when E08 exists.
    """
    return ApprovalPolicy(SINGLE)


def resolve_policy(resource_payload: dict, definition: ApprovalPolicy) -> ApprovalPolicy:
    """Resource `metadata.approvalPolicy` override wins over the definition default."""
    override = (resource_payload.get("metadata") or {}).get("approvalPolicy")
    if override:
        return ApprovalPolicy.from_dict(override)
    return definition


def _approver_ids(approvals: Iterable) -> set[str]:
    ids: set[str] = set()
    for a in approvals:
        ids.add(a["approver_id"] if isinstance(a, dict) else a)
    return ids


def is_satisfied(
    policy: ApprovalPolicy, approvals: Iterable, requester_can_approve: bool
) -> bool:
    """Has the policy been met?

    SINGLE: >=1 distinct approver. N_OF_M: >=n distinct. RBAC: any single
    authorized approval, or auto-satisfiable when the requester is permitted
    (self-service).
    """
    distinct = _approver_ids(approvals)
    if policy.mode == SINGLE:
        return len(distinct) >= 1
    if policy.mode == N_OF_M:
        return len(distinct) >= (policy.n or 0)
    if policy.mode == RBAC:
        return requester_can_approve or len(distinct) >= 1
    raise ValueError(f"unknown approval mode: {policy.mode}")
