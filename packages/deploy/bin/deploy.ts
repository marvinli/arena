#!/usr/bin/env node
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import * as cdk from "aws-cdk-lib";
import { AdminStack } from "../lib/admin-stack.js";
import { DatabaseStack } from "../lib/database-stack.js";
import { EcsStack } from "../lib/ecs-stack.js";

const region = process.env.CDK_DEFAULT_REGION ?? "us-east-1";

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region,
};

// Fetch build-time secrets from Secrets Manager so deploys don't
// depend on local env vars for keys that Vite bakes into the front-end.
async function fetchBuildSecrets(): Promise<Record<string, string>> {
  const client = new SecretsManagerClient({ region });
  const res = await client.send(
    new GetSecretValueCommand({ SecretId: "arena/api-keys" }),
  );
  return JSON.parse(res.SecretString ?? "{}");
}

const secrets = await fetchBuildSecrets();

const app = new cdk.App();

const db = new DatabaseStack(app, "ArenaDatabaseStack", { env });

const ecsStack = new EcsStack(app, "ArenaEcsStack", {
  env,
  tables: db.tables,
  tablePrefix: db.tablePrefix,
  buildSecrets: secrets,
});

new AdminStack(app, "ArenaAdminStack", {
  env,
  tables: db.tables,
  tablePrefix: db.tablePrefix,
  ecsCluster: ecsStack.cluster,
  ecsService: ecsStack.service,
});
