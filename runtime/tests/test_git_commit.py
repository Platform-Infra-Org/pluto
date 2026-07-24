"""fn-git-commit — the SOLE runtime writer to Git (design §7/§8).

Tested against a local fixture BARE repo (no network): commit writes the resource
JSON and returns the new commit sha, which is then observable in the bare repo.
"""

from __future__ import annotations

import json

import git
import pytest

from fn.git_commit import commit

IDENTITY = {"name": "platform-bot", "email": "bot@platform.local"}


@pytest.fixture
def bare_repo(tmp_path):
    """An initialised bare repo with one empty commit on the default branch."""
    bare = tmp_path / "origin.git"
    git.Repo.init(bare, bare=True, initial_branch="main")
    # seed an initial commit so the branch ref exists
    seed = git.Repo.clone_from(bare, tmp_path / "seed")
    with seed.config_writer() as cw:
        cw.set_value("user", "name", "seed").set_value("user", "email", "s@s")
    (tmp_path / "seed" / "README").write_text("seed\n")
    seed.index.add(["README"])
    seed.index.commit("seed")
    seed.remote().push("main")
    return str(bare)


def test_commit_writes_file_and_returns_sha(bare_repo, tmp_path):
    content = {"kind": "Database", "name": "app-42"}
    sha = commit(bare_repo, "resources/app-42.json", content, IDENTITY)

    assert isinstance(sha, str) and len(sha) == 40

    # observe the write in the bare repo via a fresh clone
    check = git.Repo.clone_from(bare_repo, tmp_path / "check")
    assert check.head.commit.hexsha == sha
    written = (tmp_path / "check" / "resources" / "app-42.json").read_text()
    assert json.loads(written) == content
    assert check.head.commit.author.name == "platform-bot"


def test_commit_updates_existing_path(bare_repo, tmp_path):
    commit(bare_repo, "r.json", {"v": 1}, IDENTITY)
    sha2 = commit(bare_repo, "r.json", {"v": 2}, IDENTITY)
    check = git.Repo.clone_from(bare_repo, tmp_path / "c2")
    assert check.head.commit.hexsha == sha2
    assert json.loads((tmp_path / "c2" / "r.json").read_text()) == {"v": 2}


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
