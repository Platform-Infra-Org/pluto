# CB05 runner image — bundles the pure fn.* cores behind `python -m fn.cli`.
FROM python:3.12-slim

# git is required by fn-git-commit (the sole runtime Git writer).
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
COPY fn ./fn
RUN pip install --no-cache-dir .

ENV FN_OUTPUT_DIR=/tmp/outputs
ENTRYPOINT ["python", "-m", "fn.cli"]
