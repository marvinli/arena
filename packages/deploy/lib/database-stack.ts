import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";

export class DatabaseStack extends cdk.Stack {
  readonly tables: dynamodb.ITable[];
  readonly tablePrefix: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.tablePrefix = "arena-";

    const modulesTable = new dynamodb.Table(this, "ModulesTable", {
      tableName: `${this.tablePrefix}modules`,
      partitionKey: { name: "moduleId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const instructionsTable = new dynamodb.Table(this, "InstructionsTable", {
      tableName: `${this.tablePrefix}instructions`,
      partitionKey: { name: "moduleId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestampMs", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const channelStateTable = new dynamodb.Table(this, "ChannelStateTable", {
      tableName: `${this.tablePrefix}channel-state`,
      partitionKey: {
        name: "channelKey",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const settingsTable = new dynamodb.Table(this, "SettingsTable", {
      tableName: `${this.tablePrefix}settings`,
      partitionKey: { name: "key", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const agentMessagesTable = new dynamodb.Table(this, "AgentMessagesTable", {
      tableName: `${this.tablePrefix}agent-messages`,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "seq", type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.tables = [
      modulesTable,
      instructionsTable,
      channelStateTable,
      settingsTable,
      agentMessagesTable,
    ];
  }
}
