import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

/** Root of the monorepo (two levels up from this file). */
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

export interface EcsStackProps extends cdk.StackProps {
  tables: dynamodb.ITable[];
  tablePrefix: string;
  /** Secret values fetched from Secrets Manager at deploy time (for Docker build args). */
  buildSecrets: Record<string, string>;
}

export class EcsStack extends cdk.Stack {
  readonly cluster: ecs.ICluster;
  readonly service: ecs.IBaseService;

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    // ── VPC ────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0, // public subnets only — Fargate tasks get public IPs
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    // ── Secrets ───────────────────────────────────────────
    // Pre-create this secret in the console / CLI with the JSON keys:
    //   ANTHROPIC_API_KEY,
    //   OPENAI_API_KEY,
    //   GOOGLE_GENERATIVE_AI_API_KEY,
    //   XAI_API_KEY,
    //   DEEPSEEK_API_KEY,
    //   INWORLD_API_KEY,
    //   TWITCH_RTMP_URL,
    //   YOUTUBE_RTMP_URL
    const secret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "ApiKeys",
      "arena/api-keys",
    );

    // ── ECS cluster ───────────────────────────────────────
    const cluster = new ecs.Cluster(this, "Cluster", { vpc });

    // ── Task definition (4 vCPU / 8 GB — shared by all containers) ──
    const taskDef = new ecs.FargateTaskDefinition(this, "Task", {
      cpu: 4096,
      memoryLimitMiB: 8192,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // Grant Bedrock model invocation to the task role
    taskDef.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
        resources: [
          "arn:aws:bedrock:*::foundation-model/anthropic.*",
          "arn:aws:bedrock:*::foundation-model/amazon.*",
          "arn:aws:bedrock:*::foundation-model/meta.*",
        ],
      }),
    );

    // Grant DynamoDB read/write to the task role
    for (const table of props.tables) {
      table.grantReadWriteData(taskDef.taskRole);
    }

    // ── arena-app container ───────────────────────────────
    const appContainer = taskDef.addContainer("arena-app", {
      image: ecs.ContainerImage.fromAsset(REPO_ROOT, {
        file: "Dockerfile.app",
        exclude: ["**/cdk.out"],
        buildArgs: {
          INWORLD_API_KEY: requireSecret(props.buildSecrets, "INWORLD_API_KEY"),
          VITE_CHANNEL_KEY: "poker-stream-1",
        },
      }),
      memoryLimitMiB: 2048,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "arena-app",
        logRetention: logs.RetentionDays.TWO_WEEKS,
      }),
      healthCheck: {
        command: [
          "CMD-SHELL",
          "curl -f http://localhost:4001/health || exit 1",
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(30),
      },
      environment: {
        PORT: "4001",
        TABLE_PREFIX: props.tablePrefix,
        CHANNEL_KEY: "poker-stream-1",
        NODE_ENV: "production",
        AWS_REGION: this.region,
      },
      secrets: {
        ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(
          secret,
          "ANTHROPIC_API_KEY",
        ),
        OPENAI_API_KEY: ecs.Secret.fromSecretsManager(secret, "OPENAI_API_KEY"),
        GOOGLE_GENERATIVE_AI_API_KEY: ecs.Secret.fromSecretsManager(
          secret,
          "GOOGLE_GENERATIVE_AI_API_KEY",
        ),
        XAI_API_KEY: ecs.Secret.fromSecretsManager(secret, "XAI_API_KEY"),
        DEEPSEEK_API_KEY: ecs.Secret.fromSecretsManager(
          secret,
          "DEEPSEEK_API_KEY",
        ),
        INWORLD_API_KEY: ecs.Secret.fromSecretsManager(
          secret,
          "INWORLD_API_KEY",
        ),
      },
    });

    appContainer.addPortMappings(
      { containerPort: 80 },
      { containerPort: 4001 },
    );

    // ── videographer container ────────────────────────────
    const vidContainer = taskDef.addContainer("videographer", {
      image: ecs.ContainerImage.fromAsset(REPO_ROOT, {
        file: "Dockerfile.videographer",
        exclude: ["**/cdk.out"],
      }),
      memoryLimitMiB: 4096,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "videographer",
        logRetention: logs.RetentionDays.TWO_WEEKS,
      }),
      environment: {
        FRONTEND_URL: "http://localhost/",
        CAPTURE_WIDTH: "1920",
        CAPTURE_HEIGHT: "1080",
        CAPTURE_FPS: "30",
        PROCTOR_URL: "http://localhost:4001",
        CHANNEL_KEY: "poker-stream-1",
        HEALTH_PORT: "3001",
      },
      secrets: {
        TWITCH_RTMP_URL: ecs.Secret.fromSecretsManager(
          secret,
          "TWITCH_RTMP_URL",
        ),
        YOUTUBE_RTMP_URL: ecs.Secret.fromSecretsManager(
          secret,
          "YOUTUBE_RTMP_URL",
        ),
      },
      healthCheck: {
        command: [
          "CMD-SHELL",
          "curl -f http://localhost:3001/health || exit 1",
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
      essential: false,
    });

    vidContainer.addContainerDependencies({
      container: appContainer,
      condition: ecs.ContainerDependencyCondition.HEALTHY,
    });

    // ── Fargate service (no load balancer) ───────────────
    // Construct ID changed from "Service" to force CloudFormation replacement
    // (the old service had an ALB load balancer that references the removed admin container)
    const service = new ecs.FargateService(this, "Svc", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    this.cluster = cluster;
    this.service = service;

    // ── Outputs ───────────────────────────────────────────
    new cdk.CfnOutput(this, "EcsClusterName", {
      value: cluster.clusterName,
    });

    new cdk.CfnOutput(this, "EcsServiceName", {
      value: service.serviceName,
    });
  }
}

function requireSecret(secrets: Record<string, string>, key: string): string {
  const value = secrets[key];
  if (!value) {
    throw new Error(
      `Missing required secret "${key}" in arena/api-keys (Secrets Manager)`,
    );
  }
  return value;
}
