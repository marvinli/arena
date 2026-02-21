import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DescribeServicesCommand,
  ECSClient,
  UpdateServiceCommand,
} from "@aws-sdk/client-ecs";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { createSchema, createYoga } from "graphql-yoga";
import { verifyToken } from "./auth.js";

const CHANNEL_KEY = process.env.CHANNEL_KEY ?? "poker-stream-1";
const TABLE_PREFIX = process.env.TABLE_PREFIX ?? "arena-";
const ECS_CLUSTER_NAME = process.env.ECS_CLUSTER_NAME ?? "";
const ECS_SERVICE_NAME = process.env.ECS_SERVICE_NAME ?? "";

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ecsClient = new ECSClient({});

const tableNames = {
  modules: `${TABLE_PREFIX}modules`,
  instructions: `${TABLE_PREFIX}instructions`,
  channelState: `${TABLE_PREFIX}channel-state`,
  settings: `${TABLE_PREFIX}settings`,
  agentMessages: `${TABLE_PREFIX}agent-messages`,
} as const;

// ── Schema ───────────────────────────────────────────────

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type ServiceStatus {
      status: String!
      runningCount: Int
      desiredCount: Int
      lastEvent: String
    }

    type Query {
      live: Boolean!
      serviceStatus: ServiceStatus!
    }

    type Mutation {
      setLive(live: Boolean!): Boolean!
      resetDatabase: Boolean!
      startService: Boolean!
      stopService: Boolean!
    }
  `,
  resolvers: {
    Query: {
      live: async () => {
        const result = await docClient.send(
          new GetCommand({
            TableName: tableNames.settings,
            Key: { key: `live:${CHANNEL_KEY}` },
            ProjectionExpression: "#v",
            ExpressionAttributeNames: { "#v": "value" },
          }),
        );
        return result.Item?.value === "true";
      },
      serviceStatus: () => describeService(),
    },
    Mutation: {
      setLive: async (_: unknown, { live }: { live: boolean }) => {
        await docClient.send(
          new PutCommand({
            TableName: tableNames.settings,
            Item: { key: `live:${CHANNEL_KEY}`, value: String(live) },
          }),
        );
        return live;
      },
      resetDatabase: async () => {
        const tableKeys: { table: string; keys: string[] }[] = [
          { table: tableNames.modules, keys: ["moduleId"] },
          {
            table: tableNames.instructions,
            keys: ["moduleId", "timestampMs"],
          },
          { table: tableNames.channelState, keys: ["channelKey"] },
          { table: tableNames.agentMessages, keys: ["pk", "seq"] },
        ];

        for (const { table, keys } of tableKeys) {
          let lastKey: Record<string, unknown> | undefined;
          do {
            const scan = await docClient.send(
              new ScanCommand({
                TableName: table,
                ProjectionExpression: keys.map((k) => `#${k}`).join(", "),
                ExpressionAttributeNames: Object.fromEntries(
                  keys.map((k) => [`#${k}`, k]),
                ),
                ExclusiveStartKey: lastKey,
              }),
            );

            const items = scan.Items ?? [];
            for (let i = 0; i < items.length; i += 25) {
              const batch = items.slice(i, i + 25);
              await docClient.send(
                new BatchWriteCommand({
                  RequestItems: {
                    [table]: batch.map((item) => ({
                      DeleteRequest: {
                        Key: Object.fromEntries(keys.map((k) => [k, item[k]])),
                      },
                    })),
                  },
                }),
              );
            }

            lastKey = scan.LastEvaluatedKey;
          } while (lastKey);
        }

        return true;
      },
      startService: async () => {
        await ecsClient.send(
          new UpdateServiceCommand({
            cluster: ECS_CLUSTER_NAME,
            service: ECS_SERVICE_NAME,
            desiredCount: 1,
          }),
        );
        return true;
      },
      stopService: async () => {
        await ecsClient.send(
          new UpdateServiceCommand({
            cluster: ECS_CLUSTER_NAME,
            service: ECS_SERVICE_NAME,
            desiredCount: 0,
          }),
        );
        return true;
      },
    },
  },
});

// ── Helpers ──────────────────────────────────────────────

async function describeService(): Promise<{
  status: string;
  runningCount: number | null;
  desiredCount: number | null;
  lastEvent: string | null;
}> {
  if (!ECS_CLUSTER_NAME || !ECS_SERVICE_NAME) {
    return {
      status: "not-configured",
      runningCount: null,
      desiredCount: null,
      lastEvent: null,
    };
  }
  try {
    const res = await ecsClient.send(
      new DescribeServicesCommand({
        cluster: ECS_CLUSTER_NAME,
        services: [ECS_SERVICE_NAME],
      }),
    );
    const svc = res.services?.[0];
    if (!svc)
      return {
        status: "not-found",
        runningCount: null,
        desiredCount: null,
        lastEvent: null,
      };
    return {
      status: svc.status ?? "unknown",
      runningCount: svc.runningCount ?? null,
      desiredCount: svc.desiredCount ?? null,
      lastEvent: svc.events?.[0]?.message ?? null,
    };
  } catch {
    return {
      status: "unreachable",
      runningCount: null,
      desiredCount: null,
      lastEvent: null,
    };
  }
}

// ── Yoga server with JWT auth ────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: yoga context typing requires any
export const yoga = createYoga<any>({
  schema,
  context: async ({ request }: { request: Request }) => {
    if (process.env.SKIP_AUTH === "true") {
      return { user: { sub: "local", email: "local@dev" } };
    }
    const header = request.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new Error("Unauthorized");
    }
    const token = header.slice(7);
    const user = await verifyToken(token);
    return { user };
  },
  graphiql: false,
});
