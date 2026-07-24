"""Task 4: observability — OTel is a no-op without an exporter; no secret leaks."""

import logging

import pytest

from app.obs import telemetry


def test_setup_is_noop_without_exporter(monkeypatch):
    """No OTEL_EXPORTER_OTLP_ENDPOINT -> setup returns False and never raises."""
    monkeypatch.setattr(telemetry.settings, "otel_exporter_otlp_endpoint", "")
    assert telemetry.setup_telemetry() is False
    assert telemetry.is_enabled() is False


def test_lifecycle_hooks_are_safe_noops_when_disabled():
    """Metric/trace helpers can be called unconditionally by lifecycle code."""
    telemetry._enabled = False
    telemetry.record_request_state("APPROVED")
    telemetry.record_workflow_result(True)
    telemetry.record_approval_latency(1.5)
    with telemetry.traced("submit", request_id=1):
        pass  # must not raise


@pytest.mark.parametrize(
    "line",
    [
        "logging in with access_token=abc123secret and more",
        'payload {"password": "hunter2"}',
        "Authorization: Bearer topsecrettoken",
        "api_key=sk-live-999",
    ],
)
def test_secret_redaction_filter(line):
    f = telemetry.RedactSecretsFilter()
    record = logging.LogRecord("t", logging.INFO, __file__, 1, line, None, None)
    f.filter(record)
    out = record.getMessage()
    assert "REDACTED" in out
    for leak in ("abc123secret", "hunter2", "topsecrettoken", "sk-live-999"):
        assert leak not in out
