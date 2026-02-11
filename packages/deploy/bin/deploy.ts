#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ArenaStack } from "../lib/arena-stack.js";

const app = new cdk.App();

new ArenaStack(app, "ArenaStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
  },
});
