"""Lambda "hello" da Fase 0.

Prova viva da pipeline CI/CD: se um GET nesta função via API Gateway retorna 200,
a fundação (IaC + deploy) está funcionando. Sem dependências externas — não
precisa de bundling Docker. Será substituída pelo agente real na Fase 1.
"""

import json


def handler(event, context):
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(
            {
                "message": "Hello from aws-agents-rag — deploy automatico via GitHub Actions + OIDC!",
                "phase": 0,
                "deployedBy": "github-actions",
            }
        ),
    }
