import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type * as dynamodb from "aws-cdk-lib/aws-dynamodb";
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

export interface AdminStackProps extends cdk.StackProps {
  tables: dynamodb.ITable[];
  tablePrefix: string;
  ecsCluster: ecs.ICluster;
  ecsService: ecs.IBaseService;
}

export class AdminStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AdminStackProps) {
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
        ECS_CLUSTER_NAME: props.ecsCluster.clusterName,
        ECS_SERVICE_NAME: props.ecsService.serviceName,
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
            "ecs:cluster": props.ecsCluster.clusterArn,
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

    // ── Deploy admin-fe + runtime config to S3 ──────────────
    // Two sources merged into one deployment: the Vite build output and a
    // config.js with Cognito values resolved at deploy time (CDK tokens).
    // The second source overwrites any config.js from the build, and prune
    // (default true) safely removes stale files.
    new s3deploy.BucketDeployment(this, "AdminFeDeploy", {
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
      distributionPaths: ["/*"],
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
  }
}
