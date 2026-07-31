"""Logging estruturado em JSON (Backend Standards).

Emite uma linha JSON por evento com campos fixos: `timestamp`, `level`,
`context`, `message` e, quando disponível, `correlationId`. Campos extras são
mesclados. Não logar dados sensíveis (tokens, PII, payloads completos de
terceiros) — preferir tamanhos/ids a conteúdo bruto.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any


class JsonFormatter(logging.Formatter):
    """Formata cada registro de log como uma linha JSON."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "context": record.name,
            "message": record.getMessage(),
        }
        correlation_id = getattr(record, "correlation_id", None)
        if correlation_id:
            payload["correlationId"] = correlation_id
        extra = getattr(record, "extra_fields", None)
        if extra:
            payload.update(extra)
        if record.exc_info:
            payload["error"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def get_logger(name: str = "agent") -> logging.Logger:
    """Retorna um logger configurado com saída JSON (idempotente)."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False  # evita log duplicado pelo root da Lambda
    return logger


def log(
    logger: logging.Logger,
    level: str,
    message: str,
    correlation_id: str | None = None,
    exc_info: bool = False,
    **fields: Any,
) -> None:
    """Loga uma mensagem estruturada com `correlationId` e campos extras."""
    logger.log(
        getattr(logging, level.upper()),
        message,
        exc_info=exc_info,
        extra={"correlation_id": correlation_id, "extra_fields": fields or None},
    )
