"""OpenTelemetry + structured logging with no secret leakage (E09 Task 4).

Optional by design: with no `OTEL_EXPORTER_OTLP_ENDPOINT` (or the OTel packages
absent) every hook is a **no-op** — `setup_telemetry()` just installs the secret
redaction filter and returns False. When an exporter *is* configured we wire
traces + metrics over the request lifecycle and the Argo watcher.

The metric/trace helpers are always safe to call; they do nothing until enabled,
so lifecycle code (executor, watcher, reconcile) can instrument unconditionally.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from app.config import settings

log = logging.getLogger(__name__)

# --- secret redaction ------------------------------------------------------
# Extends the notifications/main.py access_token filter to every sensitive key:
# `key=value` or `"key": "value"` -> the value is replaced with REDACTED. Never
# log tokens/passwords/secrets, whatever the surrounding format.
_SECRET_KEYS = "access_token|refresh_token|token|password|passwd|secret|authorization|api[_-]?key"
_SECRET_RE = re.compile(
    rf"(?i)(\b(?:{_SECRET_KEYS})\b[\"']?\s*[:=]\s*[\"']?)([^\s,&\"'}}]+)"
)
# `Authorization: Bearer <token>` — redact the credential after the scheme word.
_BEARER_RE = re.compile(r"(?i)(bearer\s+)([^\s,&\"']+)")


class RedactSecretsFilter(logging.Filter):
    """Rewrites `<secret-key>=<value>` -> `<secret-key>=REDACTED` in log lines."""

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        redacted = _SECRET_RE.sub(r"\1REDACTED", _BEARER_RE.sub(r"\1REDACTED", msg))
        if redacted != msg:
            record.msg = redacted
            record.args = ()
        return True


def install_log_redaction() -> RedactSecretsFilter:
    """Attach the redaction filter to the root logger's handlers (and add one if
    none exist), so no handler ever emits a secret."""
    f = RedactSecretsFilter()
    root = logging.getLogger()
    if not root.handlers:
        root.addHandler(logging.StreamHandler())
    for h in root.handlers:
        if not any(isinstance(x, RedactSecretsFilter) for x in h.filters):
            h.addFilter(f)
    return f


# --- telemetry state -------------------------------------------------------
_enabled = False
_meters: dict[str, Any] = {}


def is_enabled() -> bool:
    return _enabled


def setup_telemetry(app: Any = None) -> bool:
    """Install secret redaction always; wire OTel only when an exporter is set.

    Returns True iff OTel was actually configured. Never raises — a telemetry
    problem must not take the app down.
    """
    global _enabled
    install_log_redaction()

    if not settings.otel_exporter_otlp_endpoint:
        log.info("telemetry: no OTEL_EXPORTER_OTLP_ENDPOINT — running as no-op")
        return False
    try:
        from opentelemetry import metrics, trace
        from opentelemetry.exporter.otlp.proto.http.metric_exporter import (
            OTLPMetricExporter,
        )
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.sdk.metrics import MeterProvider
        from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        resource = Resource.create({"service.name": settings.otel_service_name})
        tp = TracerProvider(resource=resource)
        tp.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
        trace.set_tracer_provider(tp)
        reader = PeriodicExportingMetricReader(OTLPMetricExporter())
        metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[reader]))

        if app is not None:
            from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

            FastAPIInstrumentor.instrument_app(app)
        _enabled = True
        log.info("telemetry: OTel enabled -> %s", settings.otel_exporter_otlp_endpoint)
        return True
    except Exception:  # noqa: BLE001 — degrade to no-op if OTel is missing/misconfigured
        log.exception("telemetry: OTel setup failed; continuing without it")
        return False


@contextmanager
def traced(name: str, **attributes: Any) -> Iterator[None]:
    """Span around a lifecycle step; a no-op when telemetry is disabled."""
    if not _enabled:
        yield
        return
    from opentelemetry import trace

    tracer = trace.get_tracer(settings.otel_service_name)
    with tracer.start_as_current_span(name) as span:
        for k, v in attributes.items():
            span.set_attribute(k, v)
        yield


def _counter(name: str, description: str) -> Any:
    from opentelemetry import metrics

    meter = metrics.get_meter(settings.otel_service_name)
    if name not in _meters:
        _meters[name] = meter.create_counter(name, description=description)
    return _meters[name]


def record_request_state(state: str) -> None:
    """Count a request entering a state (requests-by-state metric)."""
    if not _enabled:
        return
    _counter("requests_by_state", "Request transitions by target state").add(
        1, {"state": state}
    )


def record_workflow_result(succeeded: bool) -> None:
    """Feed the workflow success-rate metric."""
    if not _enabled:
        return
    _counter("workflow_runs", "Workflow terminal results").add(
        1, {"result": "succeeded" if succeeded else "failed"}
    )


def record_approval_latency(seconds: float) -> None:
    if not _enabled:
        return
    from opentelemetry import metrics

    meter = metrics.get_meter(settings.otel_service_name)
    key = "approval_latency"
    if key not in _meters:
        _meters[key] = meter.create_histogram(
            key, unit="s", description="Seconds from submit to approval"
        )
    _meters[key].record(seconds)
