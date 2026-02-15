#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ArenaStack } from "../lib/arena-stack.js";
import { DatabaseStack } from "../lib/database-stack.js";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
};

const db = new DatabaseStack(app, "ArenaDatabaseStack", { env });

new ArenaStack(app, "ArenaStack", {
  env,
  tables: db.tables,
  tablePrefix: db.tablePrefix,
});
