#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FoundationStack } from '../lib/foundation-stack';
import { AgentStack } from '../lib/agent-stack';
import { MemoryRagStack } from '../lib/memory-rag-stack';

const app = new cdk.App();

// Conta vem do ambiente/perfil (profile `poc`); região fixada em us-east-1
// conforme a restrição do projeto.
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

new FoundationStack(app, 'FoundationStack', {
  env,
  description: 'Fase 0 — fundação: GitHub OIDC, role de deploy e Lambda hello + HTTP API',
});

new AgentStack(app, 'AgentStack', {
  env,
  description: 'Fase 1 — agente v1: Cognito (auth) + Lambda do agente + HTTP API protegido',
});

new MemoryRagStack(app, 'MemoryRagStack', {
  env,
  description: 'Fase 2 — memória (DynamoDB) + RAG (S3 + Bedrock Knowledge Base)',
});
