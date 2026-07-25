"""Dependency-graph builder tests. Uses the compose Postgres via the `session`
fixture (catalog/conftest). Resources are inserted directly through index.upsert;
no ServiceDefinition rows are needed since id_field defaults to metadata.name."""

import pytest

from app.auth.principal import Principal
from app.catalog import index
from app.catalog.graph import build_graph
from app.services.definition import ServiceDefinition  # noqa: F401 — register table

ADMIN = Principal(sub="a", username="a", groups=[], roles={"platform-admin"}, teams=set())
REQUESTER = Principal(sub="r", username="r", groups=[], roles={"requester"}, teams={"payments"})


def _res(name: str, children: dict, owner: str = "payments") -> dict:
    return {
        "apiVersion": "platform/v1",
        "kind": "X",
        "metadata": {"name": name, "ownerTeam": owner},
        "spec": {"x": 1},
        "mapping": {"children": children, "internals": {}},
    }


async def _seed(session) -> None:
    # A -> B (via child id value "B"), B -> C, D standalone.
    await index.upsert(session, type="db", name="A", owner_team="payments",
                       git_path="resources/db/A.json", git_sha="s", status="active",
                       payload=_res("A", {"net": {"inputs": {"id": "B"}}}))
    await index.upsert(session, type="db", name="B", owner_team="payments",
                       git_path="resources/db/B.json", git_sha="s", status="active",
                       payload=_res("B", {"net": {"inputs": {"id": "C"}}}))
    await index.upsert(session, type="db", name="C", owner_team="payments",
                       git_path="resources/db/C.json", git_sha="s", status="active",
                       payload=_res("C", {}))
    await index.upsert(session, type="db", name="D", owner_team="payments",
                       git_path="resources/db/D.json", git_sha="s", status="active",
                       payload=_res("D", {}))
    await session.commit()


async def _ids(session) -> dict:
    rows = await index.list_resources(session, ADMIN, page_size=100)
    return {r.name: r.id for r in rows}


@pytest.mark.anyio
async def test_graph_walks_chain(session):
    await _seed(session)
    ids = await _ids(session)
    g = await build_graph(session, ADMIN, ids["A"])
    assert {n["name"] for n in g["nodes"]} == {"A", "B", "C"}
    edges = {(e["from"], e["to"]) for e in g["edges"]}
    assert edges == {(ids["A"], ids["B"]), (ids["B"], ids["C"])}


@pytest.mark.anyio
async def test_graph_includes_parents(session):
    # C has no children, but B->C and A->B: from C we still surface the parent chain.
    await _seed(session)
    ids = await _ids(session)
    g = await build_graph(session, ADMIN, ids["C"])
    assert {n["name"] for n in g["nodes"]} == {"A", "B", "C"}
    edges = {(e["from"], e["to"]) for e in g["edges"]}
    assert edges == {(ids["A"], ids["B"]), (ids["B"], ids["C"])}


@pytest.mark.anyio
async def test_graph_no_deps_is_just_self(session):
    await _seed(session)
    ids = await _ids(session)
    g = await build_graph(session, ADMIN, ids["D"])
    assert {n["name"] for n in g["nodes"]} == {"D"}
    assert g["edges"] == []


@pytest.mark.anyio
async def test_graph_missing_resource_returns_none(session):
    await _seed(session)
    assert await build_graph(session, ADMIN, 999999) is None


@pytest.mark.anyio
async def test_graph_respects_rbac(session):
    # A references an out-of-team resource: it must not appear for the requester.
    await index.upsert(session, type="db", name="secret", owner_team="search",
                       git_path="resources/db/secret.json", git_sha="s", status="active",
                       payload=_res("secret", {}, owner="search"))
    await index.upsert(session, type="db", name="A", owner_team="payments",
                       git_path="resources/db/A.json", git_sha="s", status="active",
                       payload=_res("A", {"net": {"inputs": {"id": "secret"}}}))
    await session.commit()
    ids = await _ids(session)
    g = await build_graph(session, REQUESTER, ids["A"])
    assert {n["name"] for n in g["nodes"]} == {"A"}
    assert g["edges"] == []
