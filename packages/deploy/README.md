# Deploy

AWS CDK infrastructure for the Arena platform. Defines all cloud resources across three stacks.

## Stacks

**DatabaseStack** (`ArenaDatabaseStack`): Five DynamoDB tables (modules, instructions, channel-state, settings, agent-messages) with pay-per-request billing and a configurable table prefix (default `arena-`).

**EcsStack** (`ArenaEcsStack`): The application runtime infrastructure:

- **VPC**: Two AZs, public subnets only (no NAT gateways). Fargate tasks get public IPs.
- **ECS Fargate**: A single task definition (4 vCPU / 8 GB ARM64) running two containers:
  - `arena-app` (proctor-api + front-end, 2 GB) -- built from `Dockerfile.app`
  - `videographer` (4 GB, non-essential) -- built from `Dockerfile.videographer`, depends on arena-app health
- **Secrets Manager**: API keys (`arena/api-keys`) injected as ECS secrets.
- **IAM**: Bedrock model invocation + DynamoDB read/write on the ECS task role.

**AdminStack** (`ArenaAdminStack`): The admin dashboard and automation:

- **Cognito**: User pool with Google OAuth identity provider, `admin` group for access control, hosted UI domain.
- **Admin API (Lambda + Function URL)**: admin-api runs as a Lambda function (Node 20, ARM64, 256 MB) behind a Function URL. Granted DynamoDB read/write and ECS service management permissions.
- **Admin SPA (S3 + CloudFront)**: admin-fe is built at deploy time and served from S3 via CloudFront. A runtime `config.js` injects Cognito values. CloudFront routes `/graphql` to the Lambda and everything else to S3.
- **EventBridge Scheduler**: Four scheduled actions (warm-up, go-live, stop-live, ramp-down) that invoke the admin Lambda to automate daily stream start/stop on a configurable schedule (default 6 PM ET, 60-minute show).
- **Secrets Manager**: Google OAuth credentials (`arena/google-oauth`) for the Cognito identity provider.

## Commands

```sh
npm run build    # tsc
npm run synth    # cdk synth (generate CloudFormation)
npm run diff     # cdk diff (preview changes)
npm run deploy   # cdk deploy (deploy to AWS)
```

## Prerequisites

- AWS CLI configured with credentials
- CDK CLI installed (`npx cdk` or global `aws-cdk`)
- Secrets pre-created in Secrets Manager: `arena/api-keys` (API keys + RTMP URLs) and `arena/google-oauth` (Google OAuth client ID/secret)
- `CDK_DEFAULT_ACCOUNT` and `CDK_DEFAULT_REGION` environment variables (or AWS profile defaults)

## Key Conventions

- The CDK app entry point is `bin/deploy.ts`, which instantiates all three stacks. EcsStack depends on DatabaseStack (for table references), and AdminStack depends on both (tables + ECS cluster/service).
- ECS container images are built from the monorepo root using `ContainerImage.fromAsset` with separate Dockerfiles (`Dockerfile.app`, `Dockerfile.videographer`).
- The admin Lambda is bundled via `NodejsFunction` (esbuild, ESM) directly from `packages/admin-api/src/lambda.ts`.
- The admin-fe SPA is built inside a Docker bundling step at deploy time and uploaded to S3.
- The videographer container is marked `essential: false` so the service stays up even if streaming fails.
- `bin/deploy.ts` fetches secrets from Secrets Manager at synth time so Docker build args (e.g. Inworld API key for Vite) don't depend on local env vars.
- EcsStack outputs: ECS cluster name, ECS service name.
- AdminStack outputs: CloudFront admin URL, admin API Lambda URL, Cognito user pool ID, client ID, domain.
