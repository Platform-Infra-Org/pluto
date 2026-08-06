#!/usr/bin/env python3
"""Convert the legacy resource catalog (deploy/seed-catalog/resources/<type>/<name>.json)
into a Backstage catalog repo tree under deploy/dev/seed/catalog/.

Each resource -> a Backstage `Resource` entity. The full original definition is
preserved under `spec.definition` so the platform-catalog plugin can render the
form/raw/dependency views and pre-fill edits. A root `Location` ties them together,
and Group entities back the `owner` refs.
"""
import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "deploy", "seed-catalog", "resources")
OUT = os.path.join(ROOT, "deploy", "backstage", "seed", "catalog")


def yaml_dump(obj, indent=0):
    """Minimal YAML emitter (dicts/lists/scalars) — avoids a PyYAML dependency."""
    pad = "  " * indent
    out = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, (dict, list)) and v:
                out.append(f"{pad}{k}:")
                out.append(yaml_dump(v, indent + 1))
            elif isinstance(v, (dict, list)):
                out.append(f"{pad}{k}: {'{}' if isinstance(v, dict) else '[]'}")
            else:
                out.append(f"{pad}{k}: {scalar(v)}")
    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, (dict, list)):
                block = yaml_dump(item, indent + 1)
                first, *rest = block.split("\n")
                out.append(f"{pad}- {first.strip()}")
                out.extend(rest)
            else:
                out.append(f"{pad}- {scalar(item)}")
    return "\n".join(out)


def scalar(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v)
    if s == "" or any(c in s for c in ":#{}[],&*?|<>=!%@`\"'") or s.strip() != s:
        return json.dumps(s)
    return s


def main():
    os.makedirs(os.path.join(OUT, "resources"), exist_ok=True)
    targets = []
    teams = set()
    for path in sorted(glob.glob(os.path.join(SRC, "*", "*.json"))):
        d = json.load(open(path))
        name = d["metadata"]["name"]
        rtype = d.get("kind", "Resource").lower()
        team = d["metadata"].get("ownerTeam", "platform")
        teams.add(team)
        entity = {
            "apiVersion": "backstage.io/v1alpha1",
            "kind": "Resource",
            "metadata": {
                "name": name,
                "annotations": {"platform.io/resource-type": rtype},
            },
            "spec": {
                "type": rtype,
                "owner": f"group:default/{team}",
                "definition": d,
            },
        }
        fn = f"resources/{name}.yaml"
        open(os.path.join(OUT, fn), "w").write(yaml_dump(entity) + "\n")
        targets.append(f"./{fn}")

    # Group entities backing the owner refs (resource-owner teams) + the Keycloak
    # role-groups used for RBAC. Group names mirror the Keycloak `groups` claim.
    role_groups = ["platform-admins", "platform-auditors", "owners-payments", "service-owner"]
    groups = []
    for name in sorted(set(teams) | set(role_groups)):
        groups.append({
            "apiVersion": "backstage.io/v1alpha1",
            "kind": "Group",
            "metadata": {"name": name},
            "spec": {"type": "team", "children": []},
        })
    open(os.path.join(OUT, "groups.yaml"), "w").write(
        "\n---\n".join(yaml_dump(g) for g in groups) + "\n"
    )
    targets.insert(0, "./groups.yaml")

    # User entities for the Keycloak users, each a member of their groups. The OIDC
    # sign-in resolver matches the email local-part to these (user:default/<name>),
    # so their group memberships flow into the identity for RBAC.
    users = [
        ("admin", ["platform-admins"]),
        ("requester", ["owners-payments"]),
        ("auditor", ["platform-auditors"]),
    ]
    docs = []
    for name, member_of in users:
        docs.append({
            "apiVersion": "backstage.io/v1alpha1",
            "kind": "User",
            "metadata": {"name": name},
            "spec": {"memberOf": member_of},
        })
    open(os.path.join(OUT, "users.yaml"), "w").write(
        "\n---\n".join(yaml_dump(d) for d in docs) + "\n"
    )
    targets.insert(1, "./users.yaml")

    location = {
        "apiVersion": "backstage.io/v1alpha1",
        "kind": "Location",
        "metadata": {
            "name": "platform-catalog",
            "description": "All platform resources + owning groups",
        },
        "spec": {"type": "url", "targets": targets},
    }
    open(os.path.join(OUT, "catalog-info.yaml"), "w").write(yaml_dump(location) + "\n")
    print(f"wrote {len(targets)-1} resources + {len(groups)} groups to {OUT}")


if __name__ == "__main__":
    main()
