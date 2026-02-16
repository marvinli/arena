# Deploy

AWS CDK infrastructure for the Arena platform. Defines all cloud resources across two stacks.

## Stacks

**DatabaseStack** (`ArenaDatabaseStack`): Five DynamoDB tables (modules, instructions, channel-state, settings, agent-messages) with pay-per-request billing and a configurable table prefix (default `arena-`).

**ArenaStack** (`ArenaStack`): The application infrastructure:

- **Cognito**: User pool with Google OAuth identity provider, pre-signup Lambda to restrict by email allowlist, hosted UI domain.
- **VPC**: Two AZs, public subnets only (no NAT gateways). Fargate tasks get public IPs.
- **ECS Fargate**: A single task definition (4 vCPU / 8 GB ARM64) running three containers:
  - `arena-app` (proctor-api + front-end, 2 GB) -- built from `Dockerfile.app`
  - `videographer` (4 GB, non-essential) -- built from `Dockerfile.videographer`, depends on arena-app health
  - `admin` (admin-api + admin-fe, 512 MB) -- built from `Dockerfile.admin`
- **ALB + CloudFront**: Internet-facing ALB with CloudFront HTTPS distribution in front.
- **Secrets Manager**: API keys (`arena/api-keys`) and Google OAuth credentials (`arena/google-oauth`).
- **IAM**: Bedrock model invocation + DynamoDB read/write grants on the task role.

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
- All container images are built from the monorepo root using `ContainerImage.fromAsset` with separate Dockerfiles.
- The videographer container is marked `essential: false` so the service stays up even if streaming fails.
- Stack outputs include the CloudFront admin URL, Cognito user pool ID, client ID, and domain.
