"""Payload validation against the resource type's JSON Schema + staleness (Task 4).

The type schema comes from the Service Definition (E08); until then a config
stub. Validation runs at the submit trust boundary.
"""

import jsonschema

from app.models.request import Request

# E08 SEAM: per-type JSON Schemas live on Service Definitions. Until E08 exists,
# every type shares a minimal default requiring a `spec` object. Register a real
# per-type lookup here when E08 lands.
# ponytail: config stub, one default schema — replace with the definition lookup.
_DEFAULT_SCHEMA: dict = {
    "type": "object",
    "required": ["spec"],
    "properties": {"spec": {"type": "object"}},
}


class PayloadInvalid(Exception):
    """Submitted payload does not conform to the resource type's schema (API -> 422)."""


def type_schema(resource_type: str) -> dict:
    return _DEFAULT_SCHEMA


def validate_payload(
    resource_type: str, action: str, payload: dict, schema: dict | None = None
) -> None:
    """Validate a CREATE/UPDATE payload; DELETE only needs a target, so skip.

    `schema` is the resolved per-type/version schema from the ServiceDefinition
    (E08); callers without one fall back to the minimal default.
    """
    if action == "DELETE":
        return
    try:
        jsonschema.validate(payload, schema or type_schema(resource_type))
    except jsonschema.ValidationError as exc:
        raise PayloadInvalid(exc.message) from exc


def is_stale(req: Request, current_git_sha: str | None) -> bool:
    """True if the resource moved in Git since submit (base_git_sha != current).

    CREATE requests carry no base sha and are never stale. (Pure function: the
    caller supplies the resource's current sha from the catalog index.)
    """
    return req.base_git_sha is not None and req.base_git_sha != current_git_sha
