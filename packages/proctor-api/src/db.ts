import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_PREFIX = process.env.TABLE_PREFIX ?? "arena-";

export const tableNames = {
  modules: `${TABLE_PREFIX}modules`,
  instructions: `${TABLE_PREFIX}instructions`,
  channelState: `${TABLE_PREFIX}channel-state`,
  settings: `${TABLE_PREFIX}settings`,
  agentMessages: `${TABLE_PREFIX}agent-messages`,
} as const;

export default docClient;
