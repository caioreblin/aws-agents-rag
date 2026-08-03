import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

export interface AgentStackProps extends cdk.StackProps {
  /**
   * URLs do frontend local (Vite) usadas como callback/logout do Hosted UI e
   * origem permitida no CORS. Default: http://localhost:5173.
   */
  readonly frontendUrls?: string[];

  // --- Fase 2.8 — dependências cross-stack do MemoryRagStack --------------
  /** Tabela de memória (DynamoDB): env `MEMORY_TABLE_NAME` + grant PutItem/Query. */
  readonly memoryTable: dynamodb.ITable;
  /** ID da Bedrock Knowledge Base (RAG): env `KNOWLEDGE_BASE_ID`. */
  readonly knowledgeBaseId: string;
  /** ARN da Bedrock Knowledge Base: escopo do `bedrock:Retrieve`. */
  readonly knowledgeBaseArn: string;
}

// Modelo do agente (Haiku 4.5 via inference profile — ver design da Fase 1).
const BEDROCK_MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

/**
 * AgentStack — Fase 1 (agente v1).
 *
 * - 1.6: Cognito (User Pool + App Client + Hosted UI).
 * - 1.7: Lambda do agente (Python, bundling Docker) + HTTP API com rota
 *   `POST /chat` protegida por JWT authorizer do Cognito + IAM mínima (Bedrock).
 *
 * O deploy inicial roda com `BEDROCK_MOCK=true` (agente responde em modo mock)
 * até a cota do Bedrock da conta nova ser liberada; depois é só virar a flag.
 */
export class AgentStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: AgentStackProps) {
    super(scope, id, props);

    const frontendUrls = props.frontendUrls ?? ['http://localhost:5173'];

    // --- 1.6 — Cognito ----------------------------------------------------
    this.userPool = new cognito.UserPool(this, 'AgentUserPool', {
      userPoolName: 'aws-agents-rag',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Atenção: o prefixo do domínio Cognito NÃO pode conter as palavras
    // reservadas "aws", "cognito" ou "amazon" (senão: InvalidRequest no deploy).
    this.userPoolDomain = this.userPool.addDomain('AgentHostedUiDomain', {
      cognitoDomain: { domainPrefix: 'agents-rag-caioreblin' },
    });

    this.userPoolClient = this.userPool.addClient('AgentWebClient', {
      userPoolClientName: 'web-frontend',
      generateSecret: false,
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: frontendUrls,
        logoutUrls: frontendUrls,
      },
      preventUserExistenceErrors: true,
    });

    // --- 1.7 — Lambda do agente ------------------------------------------
    // Bundling via Docker: instala as deps de terceiros e vendoriza os dois
    // pacotes locais (`agent` e `knowledge_mcp`) no pacote da Lambda. O asset
    // aponta para `services/`, montado em /asset-input no container.
    const servicesDir = path.join(__dirname, '..', '..', 'services');
    const agentCode = lambda.Code.fromAsset(servicesDir, {
      exclude: ['**/.venv/**', '**/__pycache__/**', '**/*.pyc', '**/tests/**', '**/uv.lock'],
      bundling: {
        image: lambda.Runtime.PYTHON_3_12.bundlingImage,
        command: [
          'bash',
          '-c',
          [
            'pip install strands-agents "mcp>=1.2.0" tzdata -t /asset-output',
            'cp -r /asset-input/agent/src/agent /asset-output/agent',
            'cp -r /asset-input/mcp-servers/knowledge/src/knowledge_mcp /asset-output/knowledge_mcp',
          ].join(' && '),
        ],
      },
    });

    const agentLogGroup = new logs.LogGroup(this, 'AgentFunctionLogs', {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const agentFn = new lambda.Function(this, 'AgentFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'agent.handler.handler',
      code: agentCode,
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      logGroup: agentLogGroup,
      environment: {
        BEDROCK_MODEL_ID,
        // Começa em mock até a cota do Bedrock liberar; depois virar para 'false'.
        BEDROCK_MOCK: 'true',
        AGENT_MAX_ITERATIONS: '6',
        AGENT_MAX_TOKENS: '1024',
        // Memória (DynamoDB) e RAG (Bedrock KB) — cross-stack (2.8). A env é
        // herdada pelo subprocesso do servidor MCP (ver `mcp_client.py`), que
        // usa `KNOWLEDGE_BASE_ID` na tool `search_knowledge_base`.
        MEMORY_TABLE_NAME: props.memoryTable.tableName,
        KNOWLEDGE_BASE_ID: props.knowledgeBaseId,
        // AWS_REGION é injetada pela própria Lambda (é reservada, não setar aqui).
      },
    });

    // --- 2.8 — IAM cross-stack (least-privilege) --------------------------
    // Memória: gravar turno + ler histórico (só PutItem/Query na tabela).
    props.memoryTable.grant(agentFn, 'dynamodb:PutItem', 'dynamodb:Query');

    // RAG: recuperar trechos da Knowledge Base (retrieve puro), escopo na KB.
    agentFn.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'RetrieveFromKnowledgeBase',
        actions: ['bedrock:Retrieve'],
        resources: [props.knowledgeBaseArn],
      }),
    );

    // IAM mínima: invocar SÓ o Haiku 4.5 (modelo base em qualquer região que o
    // inference profile roteia + o próprio profile na conta).
    agentFn.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'InvokeBedrockHaiku',
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          'arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0',
          `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${BEDROCK_MODEL_ID}`,
        ],
      }),
    );

    // --- 1.7 — HTTP API protegido por Cognito ----------------------------
    const authorizer = new HttpUserPoolAuthorizer('AgentAuthorizer', this.userPool, {
      userPoolClients: [this.userPoolClient],
    });

    const httpApi = new HttpApi(this, 'AgentHttpApi', {
      apiName: 'aws-agents-rag-agent',
      corsPreflight: {
        allowOrigins: frontendUrls,
        allowMethods: [CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowHeaders: ['content-type', 'authorization', 'x-correlation-id'],
      },
    });

    httpApi.addRoutes({
      path: '/chat',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('AgentIntegration', agentFn),
      authorizer,
    });

    // --- Outputs ----------------------------------------------------------
    new cdk.CfnOutput(this, 'AgentApiUrl', {
      value: `${httpApi.apiEndpoint}/chat`,
      description: 'Endpoint do agente (POST, requer JWT do Cognito)',
    });
    new cdk.CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, 'HostedUiBaseUrl', {
      value: this.userPoolDomain.baseUrl(),
      description: 'URL base do Hosted UI (login do Cognito)',
    });
  }
}
