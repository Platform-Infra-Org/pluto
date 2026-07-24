"""Task 5 — Argo fn-* WorkflowTemplate wrappers + runner image.

- Each ``runtime/argo/fn-*.yaml`` parses as a valid WorkflowTemplate whose ``run``
  template exposes exactly the input parameters of its CB01 manifest (read straight
  from the BFF seed, so drift is caught).
- The runner CLI dispatches the pure blocks (live Argo execution deferred to a cluster).
- ``docker build`` of the runner image succeeds (skipped when no docker daemon).
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest
import yaml

RUNTIME = Path(__file__).resolve().parents[1]
ARGO = RUNTIME / "argo"
SEED = RUNTIME.parent / "apps/bff/app/blocks/seed.py"


def _manifests() -> dict[str, dict]:
    """CB01 built-in manifests keyed by their template.ref (e.g. 'fn-api-call')."""
    blocks: dict[str, dict] = {}
    for raw in re.findall(r'"""(.*?)"""', SEED.read_text(), re.DOTALL):
        try:
            doc = yaml.safe_load(raw)
        except yaml.YAMLError:
            continue  # the module docstring, not a manifest
        if isinstance(doc, dict) and doc.get("kind") == "FunctionBlock":
            blocks[doc["template"]["ref"]] = doc
    return blocks


MANIFESTS = _manifests()


def test_seed_has_all_five_blocks() -> None:
    assert set(MANIFESTS) == {
        "fn-jinja-render",
        "fn-api-call",
        "fn-json-extractor",
        "fn-set-value",
        "fn-git-commit",
    }


@pytest.mark.parametrize("ref", sorted(MANIFESTS))
def test_wrapper_is_valid_and_params_match_manifest(ref: str) -> None:
    wt = yaml.safe_load((ARGO / f"{ref}.yaml").read_text())
    assert wt["apiVersion"] == "argoproj.io/v1alpha1"
    assert wt["kind"] == "WorkflowTemplate"
    assert wt["metadata"]["name"] == ref

    run = next(t for t in wt["spec"]["templates"] if t["name"] == "run")
    param_names = {p["name"] for p in run["inputs"]["parameters"]}
    manifest_inputs = {i["name"] for i in MANIFESTS[ref]["inputs"]}
    assert param_names == manifest_inputs, ref

    # outputs match the manifest outputs too
    out_names = {p["name"] for p in run["outputs"]["parameters"]}
    manifest_outputs = {o["name"] for o in MANIFESTS[ref]["outputs"]}
    assert out_names == manifest_outputs, ref

    assert run["container"]["command"] == ["python", "-m", "fn.cli"]


def test_cli_dispatch_pure_blocks(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("FN_OUTPUT_DIR", str(tmp_path))
    from fn import cli

    cli.main(["fn.cli", "set-value", json.dumps({"expr": "a ~ b", "args": {"a": "x", "b": "y"}})])
    assert (tmp_path / "value").read_text() == "xy"

    cli.main(
        [
            "fn.cli",
            "json-extractor",
            json.dumps({"source": {"items": [{"id": 5}]}, "rules": {"id": "$.items[0].id"}}),
        ]
    )
    assert json.loads((tmp_path / "extracted").read_text()) == {"id": 5}


@pytest.mark.skipif(shutil.which("docker") is None, reason="docker not installed")
def test_docker_build_succeeds() -> None:
    # requires a running daemon + network for the base image / pip; skip if unavailable.
    if subprocess.run(["docker", "info"], capture_output=True, check=False).returncode != 0:
        pytest.skip("docker daemon not available")
    with tempfile.TemporaryDirectory() as iid:
        r = subprocess.run(
            ["docker", "build", "-t", "cb05-runtime:test", "--iidfile", f"{iid}/id", str(RUNTIME)],
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )
    assert r.returncode == 0, r.stderr[-2000:]


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
