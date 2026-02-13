import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as efs from "aws-cdk-lib/aws-efs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import * as path from "node:path";

/** Root of the monorepo (two levels up from this file). */
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

export class ArenaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── Cognito ─────────────────────────────────────────────
    const ALLOWED_EMAILS = ["marvinli@gmail.com"];

    const preSignUpFn = new lambda.Function(this, "PreSignUp", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          const allowed = process.env.ALLOWED_EMAILS.split(",");
          const email = (event.request.userAttributes.email || "").toLowerCase();
          if (!allowed.includes(email)) {
            throw new Error("Email not authorized");
          }
          event.response.autoConfirmUser = true;
          event.response.autoVerifyEmail = true;
          return event;
        };
      `),
      environment: { ALLOWED_EMAILS: ALLOWED_EMAILS.join(",") },
    });

    const userPool = new cognito.UserPool(this, "AdminUsers", {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lambdaTriggers: { preSignUp: preSignUpFn },
    });

    const googleOAuthSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "GoogleOAuth",
      "arena/google-oauth",
    );

    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(
      this,
      "Google",
      {
        userPool,
        clientId: googleOAuthSecret
          .secretValueFromJson("clientId")
          .unsafeUnwrap(),
        clientSecretValue:
          googleOAuthSecret.secretValueFromJson("clientSecret"),
        scopes: ["email", "openid", "profile"],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        },
      },
    );

    const userPoolDomain = userPool.addDomain("Domain", {
      cognitoDomain: { domainPrefix: "arena-admin" },
    });

    const cognitoDomainName = `${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`;

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
        buildArgs: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
        },
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

    // ── ALB (fronted by CloudFront) ────────────────────────
    const alb = new elbv2.ApplicationLoadBalancer(this, "AdminAlb", {
      vpc,
      internetFacing: true,
    });

    // ── CloudFront ──────────────────────────────────────────
    const distribution = new cloudfront.Distribution(this, "AdminCdn", {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(alb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      },
    });

    const cfUrl = `https://${distribution.distributionDomainName}`;

    // ── Cognito client (needs CloudFront URL for callback) ──
    const userPoolClient = userPool.addClient("AdminApp", {
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      oAuth: {
        flows: { implicitCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
        callbackUrls: [cfUrl, "http://localhost:5174", "http://localhost:8081"],
      },
    });
    userPoolClient.node.addDependency(googleProvider);

    // ── admin container (after Cognito so we can reference IDs) ──
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
        COGNITO_DOMAIN: cognitoDomainName,
        AWS_REGION: this.region,
      },
    });

    adminContainer.addPortMappings({ containerPort: 8080 });

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
      targets: [
        service.loadBalancerTarget({
          containerName: "admin",
          containerPort: 8080,
        }),
      ],
      healthCheck: {
        path: "/",
        port: "8080",
        interval: cdk.Duration.seconds(30),
        healthyThresholdCount: 2,
      },
    });

    // ── Outputs ───────────────────────────────────────────
    new cdk.CfnOutput(this, "AdminUrl", {
      value: cfUrl,
      description: "Admin dashboard URL (CloudFront HTTPS)",
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, "CognitoClientId", {
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, "CognitoDomain", {
      value: cognitoDomainName,
    });
  }
}
