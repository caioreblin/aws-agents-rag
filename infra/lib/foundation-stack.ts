import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

/**
 * Repositório GitHub autorizado a assumir a role de deploy via OIDC.
 * Usado na condição `sub` da trust policy (task 0.11).
 */
const GITHUB_REPO = 'caioreblin/aws-agents-rag';

/**
 * FoundationStack — Fase 0.
 *
 * Estabelece a base para CI/CD sem credenciais de longa duração e uma prova
 * viva da pipeline (Lambda "hello" + HTTP API):
 *  - GitHub OIDC provider (0.10)
 *  - Role de deploy assumível SÓ pelo repo/branch autorizado (0.11)
 *  - Lambda "hello" Python + API Gateway HTTP API (0.12)
 */
export class FoundationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- 0.10 — GitHub OIDC provider -------------------------------------
    // Permite que workflows do GitHub Actions troquem seu token OIDC por
    // credenciais AWS temporárias. Versões modernas do CDK gerenciam os
    // thumbprints automaticamente, então não os declaramos aqui.
    const githubOidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    // --- 0.11 — Role de deploy com trust escopada ------------------------
    // Assumível APENAS por pushes na branch `main` deste repositório. A
    // condição no `sub` é o que impede qualquer outro repo/branch de assumir
    // a role (least-privilege no CI).
    const deployRole = new iam.Role(this, 'GitHubActionsDeployRole', {
      roleName: 'github-actions-deploy-aws-agents-rag',
      description: 'Assumida pelo GitHub Actions via OIDC para rodar cdk deploy',
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.OpenIdConnectPrincipal(githubOidcProvider, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          // O GitHub emite o `sub` como `repo:OWNER/REPO@<repo_id>:ref:...`
          // (o `<repo_id>` é o ID numérico imutável do repositório). Aceitamos
          // ambos os formatos (com e sem `@id`) e apenas pushes na branch main.
          'token.actions.githubusercontent.com:sub': [
            `repo:${GITHUB_REPO}:ref:refs/heads/main`,
            `repo:${GITHUB_REPO}@*:ref:refs/heads/main`,
          ],
        },
      }),
    });

    // Permissão mínima para o CI deployar: assumir as roles criadas pelo
    // `cdk bootstrap` (deploy/file-publishing/lookup). O CDK CLI assume essas
    // roles `cdk-*` para publicar assets e executar o CloudFormation — então
    // não precisamos conceder permissões amplas de serviço à role do CI.
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AssumeCdkBootstrapRoles',
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      }),
    );

    // --- 0.12 — Lambda "hello" + HTTP API --------------------------------
    // Log group explícito com retenção curta (satisfaz também 0.16 e evita
    // custo silencioso de logs infinitos).
    const helloLogGroup = new logs.LogGroup(this, 'HelloFunctionLogs', {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const helloFn = new lambda.Function(this, 'HelloFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      // Sem dependências externas → asset simples, não precisa de bundling Docker.
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'hello')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      logGroup: helloLogGroup,
    });

    const httpApi = new apigwv2.HttpApi(this, 'HelloHttpApi', {
      apiName: 'aws-agents-rag-hello',
      description: 'HTTP API de prova da pipeline (Fase 0)',
    });

    httpApi.addRoutes({
      path: '/hello',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('HelloIntegration', helloFn),
    });

    // --- Outputs ----------------------------------------------------------
    new cdk.CfnOutput(this, 'HelloApiUrl', {
      value: `${httpApi.apiEndpoint}/hello`,
      description: 'URL para testar a Lambda hello (GET deve retornar 200)',
    });
    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description: 'ARN da role assumida pelo GitHub Actions (usar no workflow)',
    });
    new cdk.CfnOutput(this, 'GitHubOidcProviderArn', {
      value: githubOidcProvider.openIdConnectProviderArn,
      description: 'ARN do OIDC provider do GitHub',
    });
  }
}
