# Deploy

AWS CDK infrastructure for the Arena platform. Defines all cloud resources across two stacks.

## Stacks

**DatabaseStack** (`ArenaDatabaseStack`): Five DynamoDB tables (modules, instructions, channel-state, settings, agent-messages) with pay-per-request billing and a configurable table prefix (default `arena-`).

**ArenaStack** (`ArenaStack`): The application infrastructure:

- **Cognito**: User pool with Google OAuth identity provider, pre-signup Lambda to restrict by email allowlist, hosted UI domain.
- **VPC**: Two AZs, public subnets only (no NAT gateways). Fargate tasks get public IPs.
- **ECS Fargate**: A single task definition (4 vCPU / 8 GB ARM64) running two containers:
  - `arena-app` (proctor-api + front-end, 2 GB) -- built from `Dockerfile.app`
  - `videographer` (4 GB, non-essential) -- built from `Dockerfile.videographer`, depends on arena-app health
- **Admin (Lambda + S3 + CloudFront)**: admin-api runs as a Lambda function (Node 20, ARM64, 256 MB) behind a Function URL. admin-fe is built at deploy time and served from S3 via CloudFront. A runtime `config.js` injects Cognito values. CloudFront routes `/graphql` to the Lambda and everything else to S3.
- **Secrets Manager**: API keys (`arena/api-keys`) and Google OAuth credentials (`arena/google-oauth`).
- **IAM**: Bedrock model invocation + DynamoDB read/write on the ECS task role; DynamoDB + ECS service management on the admin Lambda role.

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
- Secrets pre-created in Secrets Manager: `arena/api-keys` (API keys + RTMP URL) and `arena/google-oauth` (Google OAuth client ID/secret)
- `CDK_DEFAULT_ACCOUNT` and `CDK_DEFAULT_REGION` environment variables (or AWS profile defaults)

## Key Conventions

- The CDK app entry point is `bin/deploy.ts`, which instantiates both stacks.
- ECS container images are built from the monorepo root using `ContainerImage.fromAsset` with separate Dockerfiles (`Dockerfile.app`, `Dockerfile.videographer`).
- The admin Lambda is bundled via `NodejsFunction` (esbuild, ESM) directly from `packages/admin-api/src/lambda.ts`.
- The admin-fe SPA is built inside a Docker bundling step at deploy time and uploaded to S3.
- The videographer container is marked `essential: false` so the service stays up even if streaming fails.
- `bin/deploy.ts` fetches secrets from Secrets Manager at synth time so Docker build args (e.g. Inworld API key for Vite) don't depend on local env vars.
- Stack outputs include the CloudFront admin URL, admin API Lambda URL, Cognito user pool ID, client ID, domain, ECS cluster name, and ECS service name.
