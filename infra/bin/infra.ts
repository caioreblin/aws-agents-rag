#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FoundationStack } from '../lib/foundation-stack';

const app = new cdk.App();

new FoundationStack(app, 'FoundationStack', {
  // Conta vem do ambiente/perfil (profile `poc`); região fixada em us-east-1
  // conforme a restrição do projeto.
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  description: 'Fase 0 — fundação: GitHub OIDC, role de deploy e Lambda hello + HTTP API',
});
