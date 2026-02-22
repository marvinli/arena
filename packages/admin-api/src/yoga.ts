import {
  DescribeServicesCommand,
  DescribeTasksCommand,
  ListTasksCommand,
} from "@aws-sdk/client-ecs";
import {
  BatchWriteCommand,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { createSchema, createYoga } from "graphql-yoga";
import {
  docClient,
  ecsClient,
  setLive,
  startService,
  stopService,
  tableNames,
} from "./actions.js";
import { verifyToken } from "./auth.js";

const CHANNEL_KEY = process.env.CHANNEL_KEY ?? "poker-stream-1";
const ECS_CLUSTER_NAME = process.env.ECS_CLUSTER_NAME ?? "";
const ECS_SERVICE_NAME = process.env.ECS_SERVICE_NAME ?? "";

// ── Schema ───────────────────────────────────────────────

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type ContainerStatus {
      name: String!
      lastStatus: String!
      healthStatus: String
    }

    type ServiceStatus {
      status: String!
      runningCount: Int
      desiredCount: Int
      lastEvent: String
      containers: [ContainerStatus!]!
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
        await setLive(live);
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
        await startService();
        return true;
      },
      stopService: async () => {
        await stopService();
        return true;
      },
    },
  },
});

// ── Helpers ──────────────────────────────────────────────

interface ContainerStatus {
  name: string;
  lastStatus: string;
  healthStatus: string | null;
}

async function describeService(): Promise<{
  status: string;
  runningCount: number | null;
  desiredCount: number | null;
  lastEvent: string | null;
  containers: ContainerStatus[];
}> {
  const empty = {
    runningCount: null,
    desiredCount: null,
    lastEvent: null,
    containers: [],
  };
  if (!ECS_CLUSTER_NAME || !ECS_SERVICE_NAME) {
    return { status: "not-configured", ...empty };
  }
  try {
    const res = await ecsClient.send(
      new DescribeServicesCommand({
        cluster: ECS_CLUSTER_NAME,
        services: [ECS_SERVICE_NAME],
      }),
    );
    const svc = res.services?.[0];
    if (!svc) return { status: "not-found", ...empty };

    // Fetch container-level status from running tasks
    let containers: ContainerStatus[] = [];
    if ((svc.runningCount ?? 0) > 0) {
      const taskList = await ecsClient.send(
        new ListTasksCommand({
          cluster: ECS_CLUSTER_NAME,
          serviceName: ECS_SERVICE_NAME,
        }),
      );
      const taskArns = taskList.taskArns ?? [];
      if (taskArns.length > 0) {
        const tasks = await ecsClient.send(
          new DescribeTasksCommand({
            cluster: ECS_CLUSTER_NAME,
            tasks: taskArns,
          }),
        );
        // Use the first task (service runs desiredCount=1)
        const task = tasks.tasks?.[0];
        containers =
          task?.containers?.map((c) => ({
            name: c.name ?? "unknown",
            lastStatus: c.lastStatus ?? "UNKNOWN",
            healthStatus: c.healthStatus ?? null,
          })) ?? [];
      }
    }

    return {
      status: svc.status ?? "unknown",
      runningCount: svc.runningCount ?? null,
      desiredCount: svc.desiredCount ?? null,
      lastEvent: svc.events?.[0]?.message ?? null,
      containers,
    };
  } catch {
    return { status: "unreachable", ...empty };
  }
}

// ── Yoga server with JWT auth ────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: yoga context typing requires any
export const yoga = createYoga<any>({
  schema,
  plugins: [
    {
      async onRequest({ request, fetchAPI, endResponse }) {
        if (process.env.SKIP_AUTH === "true") return;
        const header = request.headers.get("authorization");
        if (!header?.startsWith("Bearer ")) {
          endResponse(
            fetchAPI.Response.json(
              { errors: [{ message: "Unauthorized" }] },
              { status: 401 },
            ),
          );
          return;
        }
        try {
          await verifyToken(header.slice(7));
        } catch {
          endResponse(
            fetchAPI.Response.json(
              { errors: [{ message: "Unauthorized" }] },
              { status: 401 },
            ),
          );
          return;
        }
      },
    },
  ],
  context: async ({ request }: { request: Request }) => {
    if (process.env.SKIP_AUTH === "true") {
      return { user: { sub: "local", email: "local@dev" } };
    }
    // Token already verified by onRequest plugin
    const token = request.headers.get("authorization")?.slice(7) ?? "";
    const user = await verifyToken(token);
    return { user };
  },
  graphiql: false,
});
