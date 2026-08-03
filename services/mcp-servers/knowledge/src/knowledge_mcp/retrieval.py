"""Recuperação de trechos na Bedrock Knowledge Base (RAG).

Encapsula a integração `bedrock-agent-runtime.retrieve` (retrieve puro, não
`retrieve_and_generate`): devolve os trechos + a citação (arquivo/URI) de cada
um. **Quem compõe a resposta fundamentada é o agente (Claude)** no loop — aqui
só buscamos e formatamos. Manter a integração isolada deixa a tool MCP fina.
"""

from __future__ import annotations

from dataclasses import dataclass

import boto3
from botocore.exceptions import BotoCoreError, ClientError

MAX_TOP_K = 10


class RetrievalError(Exception):
    """Falha ao consultar a base de conhecimento (erro de infraestrutura)."""


@dataclass(frozen=True)
class Passage:
    """Um trecho recuperado da base + sua origem para citação."""

    text: str
    source: str
    score: float | None


def _source_uri(location: dict) -> str:
    """Extrai a URI/arquivo de origem, seja qual for o tipo de `location`.

    O `retrieve` devolve um subobjeto por tipo de fonte (`s3Location`,
    `webLocation`, ...); cada um traz `uri`/`url`. Varremos genericamente para
    não acoplar a tool a um único tipo de data source.
    """
    if not isinstance(location, dict):
        return "desconhecida"
    for value in location.values():
        if isinstance(value, dict):
            uri = value.get("uri") or value.get("url")
            if uri:
                return str(uri)
    return str(location.get("type", "desconhecida"))


def retrieve(query: str, top_k: int, kb_id: str, region: str) -> list[Passage]:
    """Consulta a KB e retorna os trechos mais relevantes com suas citações."""
    client = boto3.client("bedrock-agent-runtime", region_name=region)
    try:
        response = client.retrieve(
            knowledgeBaseId=kb_id,
            retrievalQuery={"text": query},
            retrievalConfiguration={
                "vectorSearchConfiguration": {"numberOfResults": top_k},
            },
        )
    except (BotoCoreError, ClientError) as exc:
        raise RetrievalError(str(exc)) from exc

    passages: list[Passage] = []
    for result in response.get("retrievalResults", []):
        content = result.get("content") or {}
        score = result.get("score")
        passages.append(
            Passage(
                text=str(content.get("text", "")).strip(),
                source=_source_uri(result.get("location") or {}),
                score=float(score) if isinstance(score, (int, float)) else None,
            )
        )
    return passages


def format_passages(passages: list[Passage]) -> str:
    """Formata os trechos como texto numerado com a fonte de cada um (citável)."""
    if not passages:
        return "Nenhum trecho relevante encontrado na base de conhecimento."
    blocks: list[str] = []
    for i, p in enumerate(passages, start=1):
        score = f" (score {p.score:.2f})" if p.score is not None else ""
        blocks.append(f"[{i}] fonte: {p.source}{score}\n{p.text}")
    return "\n\n".join(blocks)
