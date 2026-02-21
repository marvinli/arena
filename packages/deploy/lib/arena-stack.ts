import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as cr from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";

/** Root of the monorepo (two levels up from this file). */
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

export interface ArenaStackProps extends cdk.StackProps {
  tables: dynamodb.ITable[];
  tablePrefix: string;
  /** Secret values fetched from Secrets Manager at deploy time (for Docker build args). */
  buildSecrets: Record<string, string>;
}

export class ArenaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ArenaStackProps) {
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

    // Create client early (without CloudFront URL) to break circular dependency.
    // Callback URLs are updated via AwsCustomResource after CloudFront is created.
    const userPoolClient = userPool.addClient("AdminApp", {
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      oAuth: {
        flows: { implicitCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
        callbackUrls: ["http://localhost:5174", "http://localhost:8081"],
      },
    });
    userPoolClient.node.addDependency(googleProvider);

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
        resources: ["*"],
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

    // ── S3 bucket for admin-fe static files ──────────────
    const adminBucket = new s3.Bucket(this, "AdminBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ── Lambda function for admin-api ────────────────────
    const adminFn = new NodejsFunction(this, "AdminApi", {
      entry: path.join(REPO_ROOT, "packages/admin-api/src/lambda.ts"),
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "handler",
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      bundling: {
        format: OutputFormat.ESM,
        target: "node20",
        externalModules: ["@aws-sdk/*"],
        banner:
          "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
      environment: {
        TABLE_PREFIX: props.tablePrefix,
        CHANNEL_KEY: "poker-stream-1",
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        ECS_CLUSTER_NAME: cluster.clusterName,
        ECS_SERVICE_NAME: service.serviceName,
      },
      logRetention: logs.RetentionDays.TWO_WEEKS,
    });

    // Grant DynamoDB access to the Lambda
    for (const table of props.tables) {
      table.grantReadWriteData(adminFn);
    }

    // Grant ECS service management to the Lambda
    adminFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:ListTasks",
          "ecs:DescribeTasks",
        ],
        resources: ["*"],
        conditions: {
          ArnEquals: {
            "ecs:cluster": cluster.clusterArn,
          },
        },
      }),
    );

    // Lambda Function URL (auth handled by Cognito JWT in the app)
    const fnUrl = adminFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    // ── CloudFront ──────────────────────────────────────────
    const oai = new cloudfront.OriginAccessIdentity(this, "AdminOai");
    adminBucket.grantRead(oai);

    const distribution = new cloudfront.Distribution(this, "AdminCdn", {
      defaultBehavior: {
        origin: new origins.S3Origin(adminBucket, {
          originAccessIdentity: oai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        "/graphql": {
          origin: new origins.HttpOrigin(cdk.Fn.parseDomainName(fnUrl.url)),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 403,
          responsePagePath: "/index.html",
          responseHttpStatus: 200,
        },
        {
          httpStatus: 404,
          responsePagePath: "/index.html",
          responseHttpStatus: 200,
        },
      ],
    });

    const cfUrl = `https://${distribution.distributionDomainName}`;

    // Update Cognito client callback URLs to include the CloudFront URL.
    // This is done via a custom resource to avoid a circular dependency
    // (Lambda → client ID → CloudFront URL → Lambda Function URL → Lambda).
    new cr.AwsCustomResource(this, "UpdateCallbackUrls", {
      installLatestAwsSdk: false,
      onUpdate: {
        service: "CognitoIdentityServiceProvider",
        action: "updateUserPoolClient",
        parameters: {
          UserPoolId: userPool.userPoolId,
          ClientId: userPoolClient.userPoolClientId,
          CallbackURLs: [
            cfUrl,
            "http://localhost:5174",
            "http://localhost:8081",
          ],
          AllowedOAuthFlows: ["implicit"],
          AllowedOAuthScopes: ["openid", "email"],
          SupportedIdentityProviders: ["Google"],
          AllowedOAuthFlowsUserPoolClient: true,
        },
        physicalResourceId: cr.PhysicalResourceId.of("CallbackUrlUpdate"),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ["cognito-idp:UpdateUserPoolClient"],
          resources: [userPool.userPoolArn],
        }),
      ]),
    });

    // ── Deploy admin-fe to S3 ───────────────────────────────
    new s3deploy.BucketDeployment(this, "AdminFeAssets", {
      sources: [
        s3deploy.Source.asset(REPO_ROOT, {
          bundling: {
            image: cdk.DockerImage.fromRegistry("node:20-slim"),
            command: [
              "bash",
              "-c",
              [
                // Copy only package manifests for npm ci (avoids copying node_modules/cdk.out/.git)
                "mkdir -p /tmp/build/packages/{admin-fe,admin-api,proctor-api,front-end,videographer,deploy}",
                "cp /asset-input/package.json /asset-input/package-lock.json /asset-input/tsconfig.json /tmp/build/",
                "for pkg in admin-fe admin-api proctor-api front-end videographer deploy; do cp /asset-input/packages/$pkg/package.json /tmp/build/packages/$pkg/; done",
                "cd /tmp/build && npm ci",
                // Copy admin-fe source and build
                "cp -r /asset-input/packages/admin-fe/. /tmp/build/packages/admin-fe/",
                "cd /tmp/build && npm run build -w @arena/admin-fe",
                "cp -r /tmp/build/packages/admin-fe/dist/. /asset-output/",
              ].join(" && "),
            ],
            user: "root",
          },
          exclude: ["**/node_modules", "**/cdk.out", "**/dist", "**/.git"],
        }),
      ],
      destinationBucket: adminBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    // Deploy runtime config.js with Cognito values (resolved at deploy time)
    new s3deploy.BucketDeployment(this, "AdminFeConfig", {
      sources: [
        s3deploy.Source.data(
          "config.js",
          `window.__ARENA_CONFIG__ = ${JSON.stringify({
            cognitoDomain: cognitoDomainName,
            cognitoClientId: userPoolClient.userPoolClientId,
          })};`,
        ),
      ],
      destinationBucket: adminBucket,
      distribution,
      distributionPaths: ["/config.js"],
      prune: false,
    });

    // ── Outputs ───────────────────────────────────────────
    new cdk.CfnOutput(this, "AdminUrl", {
      value: cfUrl,
      description: "Admin dashboard URL (CloudFront HTTPS)",
    });

    new cdk.CfnOutput(this, "AdminApiUrl", {
      value: fnUrl.url,
      description: "Admin API Lambda Function URL",
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
