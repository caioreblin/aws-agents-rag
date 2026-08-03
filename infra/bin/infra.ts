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

// MemoryRagStack antes do AgentStack: expõe a tabela de memória e a Knowledge
// Base, consumidas pelo AgentStack via props (cross-stack — item 2.8). O CDK
// deriva a ordem de deploy pela dependência (MemoryRagStack → AgentStack).
const memoryRag = new MemoryRagStack(app, 'MemoryRagStack', {
  env,
  description: 'Fase 2 — memória (DynamoDB) + RAG (S3 + Bedrock Knowledge Base)',
});

new AgentStack(app, 'AgentStack', {
  env,
  description: 'Fase 1 — agente v1: Cognito (auth) + Lambda do agente + HTTP API protegido',
  memoryTable: memoryRag.memoryTable,
  knowledgeBaseId: memoryRag.knowledgeBaseId,
  knowledgeBaseArn: memoryRag.knowledgeBaseArn,
});
