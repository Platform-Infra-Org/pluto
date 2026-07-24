"""Shared graph fixtures for the generator golden tests (CB02).

Builds the design's worked-example service ``app-database`` (design 11 §4) plus a
few small variants used across the validate/waves/emit tests. Kept here (not a
conftest fixture) so a fixture is a plain function returning a fresh graph — the
generator is pure, so tests never share mutable state.
"""

from __future__ import annotations

from app.blocks.manifest import BlockManifest, IOField, parse_manifest, parse_type
from app.blocks.seed import BUILTINS
from app.generator.graph import (
    Graphs,
    Kind,
    Lit,
    Node,
    OutRef,
    Ref,
    ServiceGraph,
)

STR = parse_type("string")


def blocks() -> dict[str, BlockManifest]:
    """The block manifests the generator is passed (function blocks + the one
    dependency service ``network``, a service block with typed IO)."""
    out = {(m := parse_manifest(y)).name: m for y in BUILTINS}
    out["network"] = BlockManifest(
        name="network",
        category="service",
        template_ref="network",
        inputs=[IOField("region", STR, required=True)],
        outputs=[IOField("subnet_id", STR)],
    )
    return out


def app_database_create() -> ServiceGraph:
    """The §4 worked example — request app_name/size/region; dep network.create;
    internal api-call GET accounts -> json-extractor; main api-call POST."""
    main = Node(
        id="main",
        block="api-call",
        kind=Kind.MAIN,
        config={
            "method": "POST",
            "url": "https://db.api/databases",
            "body": {
                "name": Ref("app_name"),
                "size": Ref("size"),
                "region": Ref("region"),
                "subnet_id": OutRef("network", "subnet_id"),
                "account_id": OutRef("extract-account", "account_id"),
            },
        },
    )
    network = Node(
        id="network",
        block="network",
        kind=Kind.DEPENDENCY,
        action="create",
        input_bindings={"region": Ref("region")},
        outputs=["subnet_id"],
    )
    lookup = Node(
        id="lookup-account",
        block="api-call",
        kind=Kind.INTERNAL,
        config={"method": "GET", "url": "https://accounts.api/accounts?name={app_name}"},
        outputs=["response"],
    )
    extract = Node(
        id="extract-account",
        block="json-extractor",
        kind=Kind.INTERNAL,
        config={"rules": {"account_id": "$.items[0].id"}},
        input_bindings={"source": OutRef("lookup-account", "response")},
        outputs=["account_id"],
    )
    return ServiceGraph(
        nodes=[main, network, lookup, extract],
        request_fields={"app_name": STR, "size": STR, "region": STR},
    )


def app_database_delete() -> ServiceGraph:
    """A deliberately different delete graph (proves per-verb opt-in / §7): a lone
    main DELETE call, no dependencies or internals — looks nothing like create."""
    main = Node(
        id="main",
        block="api-call",
        kind=Kind.MAIN,
        config={
            "method": "DELETE",
            "url": "https://db.api/databases/{app_name}",
            "body": {"name": Ref("app_name")},
        },
    )
    return ServiceGraph(nodes=[main], request_fields={"app_name": STR})


def app_database(create=True, delete=False) -> Graphs:
    return Graphs(
        name="app-database",
        create=app_database_create() if create else None,
        delete=app_database_delete() if delete else None,
    )


# --- small invalid variants for validation tests ---


def two_mains() -> ServiceGraph:
    g = app_database_create()
    g.nodes.append(Node(id="main2", block="api-call", kind=Kind.MAIN, config={"method": "POST", "url": "x"}))
    return g


def missing_required() -> ServiceGraph:
    # api-call node with no url (required) and not in config
    return ServiceGraph(
        nodes=[Node(id="main", block="api-call", kind=Kind.MAIN, config={"method": "GET"})]
    )


def bad_type_wire() -> ServiceGraph:
    # bind api-call's string input `url` to a request field typed number
    return ServiceGraph(
        nodes=[
            Node(
                id="main",
                block="api-call",
                kind=Kind.MAIN,
                config={"method": "GET"},
                input_bindings={"url": Ref("count")},
            )
        ],
        request_fields={"count": parse_type("number")},
    )


def cyclic() -> ServiceGraph:
    # two extractors feeding each other's source -> cycle
    a = Node(
        id="a",
        block="json-extractor",
        kind=Kind.INTERNAL,
        config={"rules": {}},
        input_bindings={"source": OutRef("b", "extracted")},
        outputs=["extracted"],
    )
    b = Node(
        id="b",
        block="json-extractor",
        kind=Kind.INTERNAL,
        config={"rules": {}},
        input_bindings={"source": OutRef("a", "extracted")},
        outputs=["extracted"],
    )
    main = Node(id="main", block="api-call", kind=Kind.MAIN, config={"method": "GET", "url": "x"})
    return ServiceGraph(nodes=[main, a, b])


def unknown_block() -> ServiceGraph:
    return ServiceGraph(
        nodes=[
            Node(id="main", block="api-call", kind=Kind.MAIN, config={"method": "GET", "url": "x"}),
            Node(id="dep", block="nope-service", kind=Kind.DEPENDENCY, action="create"),
        ]
    )


def _leaf_service(name: str) -> ServiceGraph:
    """A service with just a main POST call, exposing output `id` (a leaf/dep)."""
    return ServiceGraph(
        nodes=[
            Node(
                id="main",
                block="api-call",
                kind=Kind.MAIN,
                config={
                    "method": "POST",
                    "url": f"https://{name}.api/{name}",
                    "body": {"env": Ref("env")},
                },
                outputs=["id"],
            )
        ],
        request_fields={"env": STR},
    )


def _service_on(name: str, dep: str) -> ServiceGraph:
    """A service that depends on `dep` (a service block) and wires dep.id into its
    main body — its main also exposes output `id`."""
    return ServiceGraph(
        nodes=[
            Node(
                id="main",
                block="api-call",
                kind=Kind.MAIN,
                config={
                    "method": "POST",
                    "url": f"https://{name}.api/{name}",
                    "body": {"env": Ref("env"), "parent_id": OutRef(dep, "id")},
                },
                outputs=["id"],
            ),
            Node(
                id=dep,
                block=dep,
                kind=Kind.DEPENDENCY,
                action="create",
                input_bindings={"env": Ref("env")},
                outputs=["id"],
            ),
        ],
        request_fields={"env": STR},
    )


def chain_blocks() -> dict[str, BlockManifest]:
    """Blocks for the A->B->C chain: api-call plus service blocks B and C, each with
    input env:string and output id:string."""
    out = blocks()
    for svc in ("B", "C"):
        out[svc] = BlockManifest(
            name=svc,
            category="service",
            template_ref=svc,
            inputs=[IOField("env", STR, required=True)],
            outputs=[IOField("id", STR)],
        )
    return out


def chain_abc() -> dict[str, Graphs]:
    """A depends on B depends on C (2-level dependency), each its own service."""
    return {
        "A": Graphs(name="A", create=_service_on("A", "B")),
        "B": Graphs(name="B", create=_service_on("B", "C")),
        "C": Graphs(name="C", create=_leaf_service("C")),
    }


__all__ = [
    "Lit",
    "chain_abc",
    "chain_blocks",
    "app_database",
    "app_database_create",
    "app_database_delete",
    "bad_type_wire",
    "blocks",
    "cyclic",
    "missing_required",
    "two_mains",
    "unknown_block",
]
