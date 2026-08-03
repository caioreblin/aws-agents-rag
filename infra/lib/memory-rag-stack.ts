import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';

/**
 * MemoryRagStack — Fase 2.
 *
 * - 2.1: memória de conversa (DynamoDB single-table).
 * - 2.5/2.6 (próximos): bucket S3 dos documentos + Bedrock Knowledge Base
 *   (S3 Vectors) para RAG.
 *
 * Expõe `memoryTable` (e, depois, o `knowledgeBaseId`) para a `agent-stack`
 * conceder acesso à Lambda do agente (cross-stack).
 */
export class MemoryRagStack extends cdk.Stack {
  public readonly memoryTable: dynamodb.Table;
  public readonly docsBucket: s3.Bucket;

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

    new cdk.CfnOutput(this, 'MemoryTableName', {
      value: this.memoryTable.tableName,
      description: 'Nome da tabela de memória do agente',
    });
    new cdk.CfnOutput(this, 'DocsBucketName', {
      value: this.docsBucket.bucketName,
      description: 'Bucket S3 dos documentos do RAG',
    });
  }
}
