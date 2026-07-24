"""fn-jinja-render — the §6 wave-resolution engine (pure).

Renders a per-service ``build-json.j2`` (as emitted by the CB02 generator) over
``request`` + ``resolved`` into the runtime *big JSON* (design §5).

The template defines a ``ph(path)`` macro that emits ``"<<path>>"`` while ``path``
is absent from ``resolved``, and the ``| tojson`` of the resolved value once present
(design §6). Resolution is a re-render between waves: render #0 with ``resolved={}``
emits placeholders; after each wave the caller grows ``resolved`` and re-renders;
when ``payload`` contains no ``<<…>>`` the main call runs.

``unresolved(doc)`` returns the ``<<…>>`` paths still present in a rendered doc, so
nothing is ever silently dropped.
"""

from __future__ import annotations

import json
import re

from jinja2 import Environment

# Matches a whole placeholder string value: "<<some.path>>"
_PLACEHOLDER = re.compile(r"^<<(?P<path>.+)>>$")

# Reused, autoescape off: build-json.j2 is JSON, not HTML.
_ENV = Environment(autoescape=False, keep_trailing_newline=True)


def render(template_j2: str, request: dict, resolved: dict) -> dict:
    """Render ``build-json.j2`` → the big-JSON document (dict).

    ``request`` supplies the known-now fields; ``resolved`` is the path→value map
    grown across waves. Unresolved ``ph()`` paths surface as ``"<<path>>"`` strings.
    """
    rendered = _ENV.from_string(template_j2).render(request=request, resolved=resolved)
    return json.loads(rendered)


def unresolved(doc: object) -> list[str]:
    """Every distinct ``<<path>>`` placeholder still present in ``doc``, in first-seen order."""
    seen: list[str] = []

    def walk(node: object) -> None:
        if isinstance(node, str):
            m = _PLACEHOLDER.match(node)
            if m and m["path"] not in seen:
                seen.append(m["path"])
        elif isinstance(node, dict):
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(doc)
    return seen
