#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ArenaStack } from "../lib/arena-stack.js";
import { AuthStack } from "../lib/auth-stack.js";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
};

const auth = new AuthStack(app, "ArenaAuthStack", { env });

new ArenaStack(app, "ArenaStack", {
  env,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
});
