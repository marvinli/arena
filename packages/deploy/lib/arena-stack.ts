import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as efs from "aws-cdk-lib/aws-efs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import * as path from "node:path";

/** Root of the monorepo (two levels up from this file). */
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

export interface ArenaStackProps extends cdk.StackProps {
  userPool: cognito.IUserPool;
  userPoolClient: cognito.IUserPoolClient;
}

export class ArenaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ArenaStackProps) {
    super(scope, id, props);

    const { userPool, userPoolClient } = props;

    // ── VPC ────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0, // public subnets only — Fargate tasks get public IPs
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    // ── EFS for SQLite persistence ────────────────────────
    const fileSystem = new efs.FileSystem(this, "Data", {
      vpc,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
    });

    const accessPoint = fileSystem.addAccessPoint("AppData", {
      path: "/arena",
      createAcl: { ownerGid: "1000", ownerUid: "1000", permissions: "755" },
      posixUser: { gid: "1000", uid: "1000" },
    });

    // ── Secrets ───────────────────────────────────────────
    // Pre-create this secret in the console / CLI with the JSON keys:
    //   ANTHROPIC_API_KEY,
    //   OPENAI_API_KEY,
    //   GOOGLE_GENERATIVE_AI_API_KEY,
    //   XAI_API_KEY,
    //   DEEPSEEK_API_KEY,
    //   RTMP_URL
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

    // Mount EFS
    taskDef.addVolume({
      name: "efs-data",
      efsVolumeConfiguration: {
        fileSystemId: fileSystem.fileSystemId,
        transitEncryption: "ENABLED",
        authorizationConfig: { accessPointId: accessPoint.accessPointId, iam: "ENABLED" },
      },
    });

    // ── arena-app container ───────────────────────────────
    const appContainer = taskDef.addContainer("arena-app", {
      image: ecs.ContainerImage.fromAsset(REPO_ROOT, {
        file: "Dockerfile.app",
        exclude: ["**/cdk.out"],
      }),
      memoryLimitMiB: 2048,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "arena-app",
        logRetention: logs.RetentionDays.TWO_WEEKS,
      }),
      healthCheck: {
        command: ["CMD-SHELL", "curl -f http://localhost:4001/health || exit 1"],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(30),
      },
      environment: {
        PORT: "4001",
        DB_PATH: "/data/arena.db",
        NODE_ENV: "production",
      },
      secrets: {
        ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(secret, "ANTHROPIC_API_KEY"),
        OPENAI_API_KEY: ecs.Secret.fromSecretsManager(secret, "OPENAI_API_KEY"),
        GOOGLE_GENERATIVE_AI_API_KEY: ecs.Secret.fromSecretsManager(secret, "GOOGLE_GENERATIVE_AI_API_KEY"),
        XAI_API_KEY: ecs.Secret.fromSecretsManager(secret, "XAI_API_KEY"),
        DEEPSEEK_API_KEY: ecs.Secret.fromSecretsManager(secret, "DEEPSEEK_API_KEY"),
      },
    });

    appContainer.addPortMappings({ containerPort: 80 }, { containerPort: 4001 });

    appContainer.addMountPoints({
      sourceVolume: "efs-data",
      containerPath: "/data",
      readOnly: false,
    });

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
        HEALTH_PORT: "3001",
      },
      secrets: {
        RTMP_URL: ecs.Secret.fromSecretsManager(secret, "RTMP_URL"),
      },
      healthCheck: {
        command: ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"],
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

    // ── admin container ──────────────────────────────────
    const adminContainer = taskDef.addContainer("admin", {
      image: ecs.ContainerImage.fromAsset(REPO_ROOT, {
        file: "Dockerfile.admin",
        exclude: ["**/cdk.out"],
      }),
      memoryLimitMiB: 512,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "admin",
        logRetention: logs.RetentionDays.TWO_WEEKS,
      }),
      healthCheck: {
        command: ["CMD-SHELL", "curl -f http://localhost:8080/ || exit 1"],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(20),
      },
      environment: {
        PORT: "3000",
        PROCTOR_URL: "http://localhost:4001",
        VIDEOGRAPHER_URL: "http://localhost:3001",
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        AWS_REGION: this.region,
      },
    });

    adminContainer.addPortMappings({ containerPort: 8080 });

    // ── ALB (admin only) ─────────────────────────────────
    const alb = new elbv2.ApplicationLoadBalancer(this, "AdminAlb", {
      vpc,
      internetFacing: true,
    });

    // ── Fargate service ───────────────────────────────────
    const service = new ecs.FargateService(this, "Service", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // Allow EFS access from Fargate tasks
    fileSystem.connections.allowDefaultPortFrom(service);

    const listener = alb.addListener("Http", { port: 80 });
    listener.addTargets("Admin", {
      port: 8080,
      targets: [service],
      healthCheck: {
        path: "/",
        port: "8080",
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
      },
    });

    // ── Outputs ───────────────────────────────────────────
    new cdk.CfnOutput(this, "AdminUrl", {
      value: `http://${alb.loadBalancerDnsName}`,
      description: "Admin dashboard URL",
    });
  }
}
