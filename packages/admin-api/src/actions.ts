import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ECSClient, UpdateServiceCommand } from "@aws-sdk/client-ecs";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const CHANNEL_KEY = process.env.CHANNEL_KEY ?? "poker-stream-1";
const TABLE_PREFIX = process.env.TABLE_PREFIX ?? "arena-";
const ECS_CLUSTER_NAME = process.env.ECS_CLUSTER_NAME ?? "";
const ECS_SERVICE_NAME = process.env.ECS_SERVICE_NAME ?? "";

export const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const ecsClient = new ECSClient({});

export const tableNames = {
  modules: `${TABLE_PREFIX}modules`,
  instructions: `${TABLE_PREFIX}instructions`,
  channelState: `${TABLE_PREFIX}channel-state`,
  settings: `${TABLE_PREFIX}settings`,
  agentMessages: `${TABLE_PREFIX}agent-messages`,
} as const;

export async function startService(): Promise<void> {
  await ecsClient.send(
    new UpdateServiceCommand({
      cluster: ECS_CLUSTER_NAME,
      service: ECS_SERVICE_NAME,
      desiredCount: 1,
    }),
  );
}

export async function stopService(): Promise<void> {
  await ecsClient.send(
    new UpdateServiceCommand({
      cluster: ECS_CLUSTER_NAME,
      service: ECS_SERVICE_NAME,
      desiredCount: 0,
    }),
  );
}

export async function setLive(live: boolean): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: tableNames.settings,
      Item: { key: `live:${CHANNEL_KEY}`, value: String(live) },
    }),
  );
}
