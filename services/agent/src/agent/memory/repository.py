"""Repositório de memória de conversa (DynamoDB single-table).

Encapsula a persistência: o loop/handler só pede "grava turno" e "histórico
recente", sem conhecer DynamoDB. Chave: `PK=SESSION#<sub>#<conv>`,
`SK=MSG#<isoTs>#<rand>` (o prefixo ISO ordena cronologicamente; o sufixo
aleatório evita colisão de duas mensagens no mesmo instante). TTL de 30 dias.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key

_TTL_SECONDS = 30 * 24 * 60 * 60  # 30 dias


@dataclass(frozen=True)
class Message:
    """Uma mensagem da conversa."""

    role: str  # "user" | "assistant"
    content: str


def session_pk(sub: str, conversation_id: str) -> str:
    """Monta a partition key da sessão (isolada por usuário via `sub`)."""
    return f"SESSION#{sub}#{conversation_id}"


class MemoryRepository:
    """Persistência de mensagens de conversa no DynamoDB."""

    def __init__(self, table_name: str, region: str) -> None:
        self._table = boto3.resource("dynamodb", region_name=region).Table(table_name)

    def save_turn(self, sub: str, conversation_id: str, role: str, content: str) -> None:
        """Grava uma mensagem (`user` ou `assistant`) da sessão."""
        now = datetime.now(timezone.utc)
        self._table.put_item(
            Item={
                "PK": session_pk(sub, conversation_id),
                "SK": f"MSG#{now.isoformat()}#{uuid.uuid4().hex[:8]}",
                "role": role,
                "content": content,
                "ttl": int(time.time()) + _TTL_SECONDS,
            }
        )

    def load_recent(self, sub: str, conversation_id: str, limit: int) -> list[Message]:
        """Retorna as últimas `limit` mensagens da sessão, em ordem cronológica."""
        response = self._table.query(
            KeyConditionExpression=Key("PK").eq(session_pk(sub, conversation_id)),
            ScanIndexForward=False,  # mais recentes primeiro (para aplicar o Limit)
            Limit=limit,
        )
        items = list(reversed(response.get("Items", [])))  # volta para cronológica
        return [Message(role=str(i["role"]), content=str(i["content"])) for i in items]
