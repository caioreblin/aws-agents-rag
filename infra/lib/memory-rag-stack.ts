import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3vectors from 'aws-cdk-lib/aws-s3vectors';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';

/**
 * MemoryRagStack — Fase 2.
 *
 * - 2.1: memória de conversa (DynamoDB single-table).
 * - 2.5: bucket S3 dos documentos do RAG.
 * - 2.6: Bedrock Knowledge Base (gerenciada) + vector store **S3 Vectors**
 *   (embeddings Titan Text Embeddings V2) + role da KB + data source S3.
 *
 * Expõe `memoryTable` e `knowledgeBaseId` para a `agent-stack` conceder acesso
 * à Lambda do agente (cross-stack — item 2.8).
 */
export class MemoryRagStack extends cdk.Stack {
  public readonly memoryTable: dynamodb.Table;
  public readonly docsBucket: s3.Bucket;
  public readonly knowledgeBaseId: string;
  public readonly knowledgeBaseArn: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- 2.1 — Memória (DynamoDB single-table) ---------------------------
    // PK=SESSION#<sub>#<conv>, SK=MSG#<isoTs>. On-demand + TTL.
    this.memoryTable = new dynamodb.Table(this, 'MemoryTable', {
      tableName: 'aws-agents-rag-memory',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // estudo: pode recriar
    });

    // --- 2.5 — Bucket S3 dos documentos do RAG --------------------------
    // Block Public Access, criptografia gerenciada, auto-delete no destroy
    // (conveniência de estudo). Nome com account id para unicidade global.
    this.docsBucket = new s3.Bucket(this, 'DocsBucket', {
      bucketName: `aws-agents-rag-docs-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // --- 2.6 — RAG: S3 Vectors + Bedrock Knowledge Base -----------------
    // Nota (risco do design resolvido): aws-cdk-lib 2.262.x já tem L1 nativo
    // para S3 Vectors (`AWS::S3Vectors::*`) e `s3VectorsConfiguration` na
    // `AWS::Bedrock::KnowledgeBase` — não é preciso fallback via CLI/console.

    // Embeddings: Titan Text Embeddings V2 (1024 dims, float32, cosine).
    const embeddingModelArn =
      `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`;
    const EMBEDDING_DIMENSION = 1024;

    // Vector store barato: bucket + índice de vetores S3 Vectors (pay-per-use,
    // sem compute ligado). Nome com account id para unicidade global.
    const vectorBucket = new s3vectors.CfnVectorBucket(this, 'VectorBucket', {
      vectorBucketName: `aws-agents-rag-vectors-${this.account}`,
    });
    // O destroy só apaga bucket de vetores vazio; solta em estudo.
    vectorBucket.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    const vectorIndex = new s3vectors.CfnIndex(this, 'VectorIndex', {
      indexName: 'aws-agents-rag-index',
      vectorBucketArn: vectorBucket.attrVectorBucketArn,
      dataType: 'float32',
      dimension: EMBEDDING_DIMENSION,
      distanceMetric: 'cosine',
      // O Bedrock guarda o texto do chunk e os metadados como metadados
      // NÃO-filtráveis (evita estourar o limite de metadados filtráveis por
      // vetor). Chaves exigidas pela integração KB × S3 Vectors.
      metadataConfiguration: {
        nonFilterableMetadataKeys: ['AMAZON_BEDROCK_METADATA', 'AMAZON_BEDROCK_TEXT'],
      },
    });
    vectorIndex.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    // Role da KB (least-privilege). Políticas conforme a doc oficial do
    // Bedrock (trust por SourceAccount+SourceArn da KB; invocar embeddings;
    // ler o bucket de docs; ler/gravar o índice S3 Vectors). Inline para que
    // as permissões existam antes de a KB ser criada.
    const kbRole = new iam.Role(this, 'KnowledgeBaseRole', {
      roleName: 'aws-agents-rag-kb-role',
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com', {
        conditions: {
          StringEquals: { 'aws:SourceAccount': this.account },
          ArnLike: {
            'aws:SourceArn': `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/*`,
          },
        },
      }),
      inlinePolicies: {
        KnowledgeBaseAccess: new iam.PolicyDocument({
          statements: [
            // Invocar o modelo de embeddings.
            new iam.PolicyStatement({
              sid: 'BedrockInvokeEmbeddingModel',
              actions: ['bedrock:InvokeModel'],
              resources: [embeddingModelArn],
            }),
            // Ler o corpus no bucket de documentos.
            new iam.PolicyStatement({
              sid: 'S3ListDocsBucket',
              actions: ['s3:ListBucket'],
              resources: [this.docsBucket.bucketArn],
              conditions: { StringEquals: { 'aws:ResourceAccount': this.account } },
            }),
            new iam.PolicyStatement({
              sid: 'S3GetDocsObjects',
              actions: ['s3:GetObject'],
              resources: [`${this.docsBucket.bucketArn}/*`],
              conditions: { StringEquals: { 'aws:ResourceAccount': this.account } },
            }),
            // Ler/gravar o índice de vetores S3 Vectors.
            new iam.PolicyStatement({
              sid: 'S3VectorsReadWrite',
              actions: [
                's3vectors:PutVectors',
                's3vectors:GetVectors',
                's3vectors:DeleteVectors',
                's3vectors:QueryVectors',
                's3vectors:GetIndex',
              ],
              resources: [vectorIndex.attrIndexArn],
            }),
          ],
        }),
      },
    });

    // Knowledge Base gerenciada, tipo VECTOR, armazenando em S3 Vectors.
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
      name: 'aws-agents-rag-kb',
      description: 'RAG do projeto: docs do repo (PLAN.md, README, docs/*.md).',
      roleArn: kbRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn,
          embeddingModelConfiguration: {
            bedrockEmbeddingModelConfiguration: {
              dimensions: EMBEDDING_DIMENSION,
              embeddingDataType: 'FLOAT32',
            },
          },
        },
      },
      storageConfiguration: {
        type: 'S3_VECTORS',
        s3VectorsConfiguration: {
          vectorBucketArn: vectorBucket.attrVectorBucketArn,
          indexArn: vectorIndex.attrIndexArn,
        },
      },
    });
    // A KB depende explicitamente do índice (o L1 já cria a dep pelo ARN, mas
    // deixamos explícito por clareza de ordenação).
    knowledgeBase.node.addDependency(vectorIndex);

    // Data source S3: o corpus a ser indexado (ingestão/sync no item 2.9).
    const dataSource = new bedrock.CfnDataSource(this, 'DocsDataSource', {
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      name: 'docs-s3',
      dataDeletionPolicy: 'DELETE', // estudo: apaga vetores ao remover o DS
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: this.docsBucket.bucketArn,
        },
      },
    });
    dataSource.node.addDependency(knowledgeBase);

    this.knowledgeBaseId = knowledgeBase.attrKnowledgeBaseId;
    this.knowledgeBaseArn = knowledgeBase.attrKnowledgeBaseArn;

    new cdk.CfnOutput(this, 'MemoryTableName', {
      value: this.memoryTable.tableName,
      description: 'Nome da tabela de memória do agente',
    });
    new cdk.CfnOutput(this, 'DocsBucketName', {
      value: this.docsBucket.bucketName,
      description: 'Bucket S3 dos documentos do RAG',
    });
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: this.knowledgeBaseId,
      description: 'ID da Bedrock Knowledge Base (RAG)',
    });
    new cdk.CfnOutput(this, 'VectorBucketName', {
      value: vectorBucket.ref,
      description: 'Bucket S3 Vectors que guarda os embeddings',
    });
  }
}
