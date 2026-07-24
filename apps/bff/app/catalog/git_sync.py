"""Git sync worker: read-only clone/pull of the resource repo, then parse,
validate and upsert each JSON into the catalog index.

The app NEVER writes Git — this only clones/pulls/reads. Invalid files are
indexed with status='invalid' (surfaced, not dropped); rows for files that
vanished are deleted. The index is a rebuildable cache; Git stays authoritative.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from git import Repo

from app.catalog import index
from app.catalog.ownership import resolve_owner_team
from app.config import settings
from app.db import async_session_factory

RESOURCES_DIR = "resources"


@dataclass
class SyncReport:
    indexed: int = 0
    invalid: int = 0
    deleted: int = 0


def _auth_url(url: str, token: str) -> str:
    """Inject a read token into an https URL. Local paths pass through."""
    if not token or not url.startswith("http"):
        return url
    parts = urlsplit(url)
    netloc = f"x-access-token:{token}@{parts.hostname}"
    if parts.port:
        netloc += f":{parts.port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


def _clone_or_pull(url: str, branch: str, dest: Path) -> Repo:
    if (dest / ".git").exists():
        repo = Repo(dest)
        repo.remotes.origin.pull(branch)
        return repo
    dest.parent.mkdir(parents=True, exist_ok=True)
    return Repo.clone_from(_auth_url(url, settings.git_read_token), str(dest), branch=branch)


def validate_resource(payload: dict) -> str | None:
    """Minimal resource-type validation. Returns an error message or None.

    ponytail: shallow check (dict + object `spec`) until per-type JSON-schema
    Service Definitions land (E08); swap this body for schema validation then.
    """
    if not isinstance(payload, dict):
        return "resource is not a JSON object"
    if not isinstance(payload.get("spec"), dict):
        return "missing 'spec' object"
    return None


def _type_and_name(rel_path: str) -> tuple[str, str]:
    """resources/<type>/<name>.json -> (type, name)."""
    p = Path(rel_path)
    parts = p.parts
    type_ = parts[1] if len(parts) >= 3 else "unknown"
    return type_, p.stem


def _collect(repo: Repo) -> list[dict]:
    """Walk the resources tree, parse each JSON, resolve owner/type/sha/status.
    Pure/blocking — call via to_thread."""
    assert repo.working_tree_dir is not None  # bare repos never reach the sync path
    root = Path(repo.working_tree_dir)
    out: list[dict] = []
    res_root = root / RESOURCES_DIR
    if not res_root.exists():
        return out
    for file in sorted(res_root.rglob("*.json")):
        rel = file.relative_to(root).as_posix()
        raw = file.read_text()
        error: str | None
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            payload, error = {}, f"invalid JSON: {exc}"
        else:
            error = validate_resource(payload)
        type_, name = _type_and_name(rel)
        sha = next(repo.iter_commits(paths=rel, max_count=1)).hexsha
        out.append(
            {
                "type": type_,
                "name": name,
                "owner_team": resolve_owner_team(payload, rel),
                "git_path": rel,
                "git_sha": sha,
                "payload": payload if error is None else {**payload, "_error": error},
                "status": "invalid" if error else "active",
            }
        )
    return out


async def sync_repo(session=None) -> SyncReport:
    """Pull the repo, index every resource, delete rows for vanished files."""
    dest = Path(settings.git_cache_dir)
    repo = await asyncio.to_thread(
        _clone_or_pull, settings.git_repo_url, settings.git_branch, dest
    )
    records = await asyncio.to_thread(_collect, repo)

    own_session = session is None
    session = session or async_session_factory()
    try:
        report = SyncReport()
        for rec in records:
            await index.upsert(session, **rec)
            report.invalid += rec["status"] == "invalid"
            report.indexed += rec["status"] == "active"
        report.deleted = await index.delete_missing(session, {r["git_path"] for r in records})
        await session.commit()
        return report
    finally:
        if own_session:
            await session.close()
