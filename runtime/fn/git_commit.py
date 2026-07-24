"""fn-git-commit — commit the resource JSON to Git (the runtime write path, §7/§8).

This is the ONLY component that writes to Git at runtime: the sole-writer invariant
lives here, not in the BFF (which only prints templates). ``commit`` clones the
target repo into a temp workdir, writes ``content`` as pretty JSON at ``path``,
commits it under ``identity``, pushes, and returns the new commit sha.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Any

import git


def commit(repo: str, path: str, content: Any, identity: dict[str, str], *, branch: str = "main") -> str:
    """Write ``content`` (JSON) to ``path`` in ``repo`` and return the commit sha."""
    with tempfile.TemporaryDirectory() as workdir:
        clone = git.Repo.clone_from(repo, workdir, branch=branch)
        with clone.config_writer() as cw:
            cw.set_value("user", "name", identity["name"])
            cw.set_value("user", "email", identity["email"])

        target = Path(workdir) / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(content, indent=2, sort_keys=True) + "\n")

        clone.index.add([path])
        new_commit = clone.index.commit(f"commit {path}")
        clone.remote().push(branch)
        return new_commit.hexsha
