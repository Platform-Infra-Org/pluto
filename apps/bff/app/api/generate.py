"""Generate-preview API (CB03 Task 1).

`POST /api/services/generate` is a thin, authed wrapper over the pure CB02
generator: it loads the block palette from the registry, parses the posted graph
JSON, and calls `generate()`. Validation errors are **returned** (200 with
`errors[]` and empty artifacts), never raised — so the graph editor can render the
errors while the owner keeps editing. The BFF still never writes Git.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import current_principal
from app.auth.principal import Principal
from app.blocks import registry
from app.blocks.manifest import ManifestError
from app.db import get_session
from app.generator.generate import GenerationError, generate
from app.generator.graph import parse_graphs

router = APIRouter(prefix="/api/services")


class GenerateBody(BaseModel):
    graphs: dict  # CB03 graph JSON (see graph.parse_graphs)


@router.post("/generate")
async def generate_preview(
    body: GenerateBody,
    _: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> dict:
    blocks = await registry.load_manifests(session)
    try:
        # parse_graphs is inside the guard: malformed free-form JSON must surface as
        # errors[] (200), never a 500 (the editor posts partial graphs while editing).
        graphs = parse_graphs(body.graphs)
        gen = generate(graphs, blocks)
    except GenerationError as exc:
        errors = [str(e) for e in exc.errors] or [str(exc)]
        return {"build_json_j2": "", "workflow_template_yaml": "", "errors": errors}
    except (KeyError, ValueError, TypeError, AttributeError, ManifestError) as exc:
        return {"build_json_j2": "", "workflow_template_yaml": "", "errors": [str(exc)]}
    return {
        "build_json_j2": gen.build_json_j2,
        "workflow_template_yaml": gen.workflow_template_yaml,
        "errors": [],
    }
