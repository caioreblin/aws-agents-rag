"""Entrypoint da Lambda do agente (API Gateway HTTP API, payload v2).

Handler fino: valida a entrada, propaga o `correlationId`, delega ao loop do
agente e traduz a resposta/erro em HTTP — sem 500 cru. A regra de negócio mora
em `loop.py`; aqui só cuidamos da fronteira HTTP e da observabilidade.
"""

from __future__ import annotations

import base64
import json
import uuid
from typing import Any

from agent.config import load_config
from agent.logging_config import get_logger, log
from agent.loop import run_agent

logger = get_logger("agent.handler")


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    correlation_id = _correlation_id(event)

    try:
        payload = _parse_body(event)
    except (ValueError, TypeError):
        log(logger, "warning", "corpo JSON inválido", correlation_id)
        return _response(400, {"error": "Corpo inválido: esperado JSON."}, correlation_id)

    message = str(payload.get("message") or "").strip()
    if not message:
        log(logger, "warning", "campo 'message' ausente", correlation_id)
        return _response(400, {"error": "Campo 'message' é obrigatório."}, correlation_id)

    log(logger, "info", "agent.request", correlation_id, message_len=len(message))
    try:
        reply = run_agent(message, correlation_id, load_config())
    except Exception:  # noqa: BLE001 — fronteira: nada de 500 cru para o cliente
        log(logger, "error", "erro ao executar o agente", correlation_id, exc_info=True)
        return _response(500, {"error": "Erro interno ao processar a mensagem."}, correlation_id)

    log(logger, "info", "agent.response", correlation_id, reply_len=len(reply))
    return _response(200, {"reply": reply}, correlation_id)


def _parse_body(event: dict[str, Any]) -> dict[str, Any]:
    raw = event.get("body")
    if raw is None:
        return {}
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("corpo deve ser um objeto JSON")
    return parsed


def _correlation_id(event: dict[str, Any]) -> str:
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    incoming = headers.get("x-correlation-id")
    if incoming:
        return str(incoming)
    request_context = event.get("requestContext") or {}
    return str(request_context.get("requestId") or uuid.uuid4())


def _response(status: int, body: dict[str, Any], correlation_id: str) -> dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({**body, "correlationId": correlation_id}, ensure_ascii=False),
    }
