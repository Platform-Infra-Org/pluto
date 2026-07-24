"""Fix 3: the SSE access_token query param must never survive into logs."""

import logging

from app.main import RedactAccessTokenFilter


def _record(msg, args=()):
    return logging.LogRecord("uvicorn.access", logging.INFO, __file__, 0, msg, args, None)


def test_redacts_access_token_in_plain_message():
    rec = _record('GET /api/notifications/stream?access_token=s3cr3t HTTP/1.1')
    assert RedactAccessTokenFilter().filter(rec) is True
    out = rec.getMessage()
    assert "access_token=REDACTED" in out
    assert "s3cr3t" not in out


def test_redacts_access_token_carried_in_args():
    # uvicorn access logs put the request line in %-args, not the template.
    rec = _record('%s', ('GET /stream?access_token=s3cr3t&x=1 HTTP/1.1',))
    RedactAccessTokenFilter().filter(rec)
    out = rec.getMessage()
    assert "access_token=REDACTED" in out and "s3cr3t" not in out
    assert "x=1" in out  # only the token is scrubbed


def test_leaves_unrelated_lines_untouched():
    rec = _record('GET /healthz HTTP/1.1')
    RedactAccessTokenFilter().filter(rec)
    assert rec.getMessage() == 'GET /healthz HTTP/1.1'
