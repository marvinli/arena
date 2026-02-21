import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── In-memory stores ────────────────────────────────────────

const settingsStore = new Map<string, string>();
let ecsUpdateCalls: {
  cluster: string;
  service: string;
  desiredCount: number;
}[] = [];
let ecsServiceResponse: {
  status: string;
  runningCount: number;
  desiredCount: number;
  events: { message: string }[];
} | null = null;
let ecsTaskContainers: {
  name: string;
  lastStatus: string;
  healthStatus?: string;
}[] = [];
let scanItemsByTable: Record<string, Record<string, unknown>[]> = {};
let batchDeleteCalls: { table: string; keys: Record<string, unknown>[] }[] = [];

// ── Mock @aws-sdk/client-dynamodb ───────────────────────────

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: class {},
}));

// ── Mock @aws-sdk/lib-dynamodb ──────────────────────────────

vi.mock("@aws-sdk/lib-dynamodb", () => {
  class GetCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class PutCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class ScanCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class BatchWriteCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  const send = vi.fn(async (cmd: unknown) => {
    if (cmd instanceof GetCommand) {
      const key = cmd.input.Key as Record<string, string>;
      const val = settingsStore.get(key.key as string);
      return val != null ? { Item: { key: key.key, value: val } } : {};
    }
    if (cmd instanceof PutCommand) {
      const item = cmd.input.Item as Record<string, string>;
      if ((cmd.input.TableName as string).endsWith("settings")) {
        settingsStore.set(item.key, item.value);
      }
      return {};
    }
    if (cmd instanceof ScanCommand) {
      const table = cmd.input.TableName as string;
      return { Items: scanItemsByTable[table] ?? [] };
    }
    if (cmd instanceof BatchWriteCommand) {
      const reqItems = cmd.input.RequestItems as Record<string, unknown[]>;
      for (const [table, reqs] of Object.entries(reqItems)) {
        const keys = (
          reqs as { DeleteRequest: { Key: Record<string, unknown> } }[]
        ).map((r) => r.DeleteRequest.Key);
        batchDeleteCalls.push({ table, keys });
      }
      return {};
    }
    return {};
  });

  return {
    DynamoDBDocumentClient: {
      from: () => ({ send }),
    },
    GetCommand,
    PutCommand,
    ScanCommand,
    BatchWriteCommand,
  };
});

// ── Mock @aws-sdk/client-ecs ────────────────────────────────

vi.mock("@aws-sdk/client-ecs", () => {
  class DescribeServicesCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class UpdateServiceCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class ListTasksCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }
  class DescribeTasksCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  const send = vi.fn(async (cmd: unknown) => {
    if (cmd instanceof DescribeServicesCommand) {
      return { services: ecsServiceResponse ? [ecsServiceResponse] : [] };
    }
    if (cmd instanceof UpdateServiceCommand) {
      const input = (cmd as UpdateServiceCommand).input;
      ecsUpdateCalls.push({
        cluster: input.cluster as string,
        service: input.service as string,
        desiredCount: input.desiredCount as number,
      });
      return {};
    }
    if (cmd instanceof ListTasksCommand) {
      return {
        taskArns: ecsTaskContainers.length > 0 ? ["arn:aws:ecs:us-east-1:123:task/test/abc"] : [],
      };
    }
    if (cmd instanceof DescribeTasksCommand) {
      return {
        tasks: [{ containers: ecsTaskContainers }],
      };
    }
    return {};
  });

  return {
    ECSClient: class {
      send = send;
    },
    DescribeServicesCommand,
    UpdateServiceCommand,
    ListTasksCommand,
    DescribeTasksCommand,
  };
});

// ── Mock auth (path relative to test file → resolves to src/auth.js) ──

vi.mock("../src/auth.js", () => ({
  verifyToken: async (token: string) => {
    if (token === "valid-token")
      return { sub: "user-1", email: "test@test.com" };
    throw new Error("Invalid token");
  },
}));

// ── Setup env before importing modules ──────────────────────

process.env.SKIP_AUTH = "true";
process.env.CHANNEL_KEY = "test-channel";
process.env.TABLE_PREFIX = "test-";
process.env.ECS_CLUSTER_NAME = "test-cluster";
process.env.ECS_SERVICE_NAME = "test-service";

// ── Import after mocks are in place ─────────────────────────

const { yoga } = await import("../src/yoga.js");
const { handler } = await import("../src/lambda.js");

// ── Helpers ─────────────────────────────────────────────────

async function gql(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<{
  data?: Record<string, unknown>;
  errors?: { message: string }[];
}> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await yoga.fetch("http://localhost/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

function makeLambdaEvent(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
) {
  const body = JSON.stringify({ query, variables });
  const headers: Record<string, string> = {
    "content-type": "application/json",
    host: "test.lambda-url.us-east-1.on.aws",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  return {
    rawPath: "/graphql",
    rawQueryString: "",
    headers,
    body,
    isBase64Encoded: false,
    requestContext: {
      http: {
        method: "POST",
        path: "/graphql",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      accountId: "123456789",
      apiId: "test",
      domainName: "test.lambda-url.us-east-1.on.aws",
      domainPrefix: "test",
      requestId: "test-id",
      routeKey: "$default",
      stage: "$default",
      time: "01/Jan/2025:00:00:00 +0000",
      timeEpoch: 0,
    },
    version: "2.0",
    routeKey: "$default",
  };
}

// ── Tests ───────────────────────────────────────────────────

beforeEach(() => {
  settingsStore.clear();
  ecsUpdateCalls = [];
  ecsServiceResponse = null;
  ecsTaskContainers = [];
  scanItemsByTable = {};
  batchDeleteCalls = [];
  process.env.SKIP_AUTH = "true";
});

afterEach(() => {
  process.env.SKIP_AUTH = "true";
});

// ── Auth ────────────────────────────────────────────────────

describe("auth", () => {
  it("allows requests when SKIP_AUTH=true", async () => {
    const res = await gql("{ live }");
    expect(res.errors).toBeUndefined();
    expect(res.data).toBeDefined();
  });

  it("rejects requests without a token when auth is enabled", async () => {
    delete process.env.SKIP_AUTH;
    const res = await gql("{ live }");
    expect(res.errors).toBeDefined();
    expect(res.data ?? null).toBeNull();
  });

  it("rejects requests with an invalid token", async () => {
    delete process.env.SKIP_AUTH;
    const res = await gql("{ live }", undefined, "bad-token");
    expect(res.errors).toBeDefined();
    expect(res.data ?? null).toBeNull();
  });

  it("allows requests with a valid token", async () => {
    delete process.env.SKIP_AUTH;
    const res = await gql("{ live }", undefined, "valid-token");
    expect(res.errors).toBeUndefined();
    expect(res.data).toBeDefined();
  });
});

// ── Queries ─────────────────────────────────────────────────

describe("live query", () => {
  it("returns false when live flag is not set", async () => {
    const res = await gql("{ live }");
    expect(res.data!.live).toBe(false);
  });

  it("returns true when live flag is set", async () => {
    settingsStore.set("live:test-channel", "true");
    const res = await gql("{ live }");
    expect(res.data!.live).toBe(true);
  });

  it("returns false when live flag is explicitly false", async () => {
    settingsStore.set("live:test-channel", "false");
    const res = await gql("{ live }");
    expect(res.data!.live).toBe(false);
  });
});

describe("serviceStatus query", () => {
  it("returns service info from ECS", async () => {
    ecsServiceResponse = {
      status: "ACTIVE",
      runningCount: 1,
      desiredCount: 1,
      events: [{ message: "service reached a steady state." }],
    };
    ecsTaskContainers = [
      { name: "arena-app", lastStatus: "RUNNING", healthStatus: "HEALTHY" },
      { name: "videographer", lastStatus: "RUNNING", healthStatus: "HEALTHY" },
    ];
    const res = await gql(
      "{ serviceStatus { status runningCount desiredCount lastEvent containers { name lastStatus healthStatus } } }",
    );
    expect(res.data!.serviceStatus).toEqual({
      status: "ACTIVE",
      runningCount: 1,
      desiredCount: 1,
      lastEvent: "service reached a steady state.",
      containers: [
        { name: "arena-app", lastStatus: "RUNNING", healthStatus: "HEALTHY" },
        {
          name: "videographer",
          lastStatus: "RUNNING",
          healthStatus: "HEALTHY",
        },
      ],
    });
  });

  it("returns empty containers when service is stopped", async () => {
    ecsServiceResponse = {
      status: "ACTIVE",
      runningCount: 0,
      desiredCount: 0,
      events: [{ message: "service reached a steady state." }],
    };
    const res = await gql(
      "{ serviceStatus { status runningCount containers { name } } }",
    );
    const status = res.data!.serviceStatus as {
      containers: unknown[];
    };
    expect(status.containers).toEqual([]);
  });

  it("returns not-found when ECS returns no services", async () => {
    ecsServiceResponse = null;
    const res = await gql("{ serviceStatus { status } }");
    expect((res.data!.serviceStatus as { status: string }).status).toBe(
      "not-found",
    );
  });
});

// ── Mutations ───────────────────────────────────────────────

describe("setLive mutation", () => {
  it("sets the live flag to true", async () => {
    const res = await gql("mutation { setLive(live: true) }");
    expect(res.data!.setLive).toBe(true);
    expect(settingsStore.get("live:test-channel")).toBe("true");
  });

  it("sets the live flag to false", async () => {
    settingsStore.set("live:test-channel", "true");
    const res = await gql("mutation { setLive(live: false) }");
    expect(res.data!.setLive).toBe(false);
    expect(settingsStore.get("live:test-channel")).toBe("false");
  });
});

describe("resetDatabase mutation", () => {
  it("scans and batch-deletes from all game tables", async () => {
    scanItemsByTable = {
      "test-modules": [{ moduleId: "m1" }],
      "test-instructions": [{ moduleId: "m1", timestampMs: 100 }],
      "test-channel-state": [{ channelKey: "test-channel" }],
      "test-agent-messages": [{ pk: "m1#p1", seq: 0 }],
    };

    const res = await gql("mutation { resetDatabase }");
    expect(res.data!.resetDatabase).toBe(true);
    expect(batchDeleteCalls).toHaveLength(4);

    const deletedTables = batchDeleteCalls.map((c) => c.table).sort();
    expect(deletedTables).toEqual([
      "test-agent-messages",
      "test-channel-state",
      "test-instructions",
      "test-modules",
    ]);
  });

  it("succeeds when tables are empty", async () => {
    const res = await gql("mutation { resetDatabase }");
    expect(res.data!.resetDatabase).toBe(true);
    expect(batchDeleteCalls).toHaveLength(0);
  });
});

describe("startService mutation", () => {
  it("calls UpdateService with desiredCount=1", async () => {
    const res = await gql("mutation { startService }");
    expect(res.data!.startService).toBe(true);
    expect(ecsUpdateCalls).toHaveLength(1);
    expect(ecsUpdateCalls[0]).toEqual({
      cluster: "test-cluster",
      service: "test-service",
      desiredCount: 1,
    });
  });
});

describe("stopService mutation", () => {
  it("calls UpdateService with desiredCount=0", async () => {
    const res = await gql("mutation { stopService }");
    expect(res.data!.stopService).toBe(true);
    expect(ecsUpdateCalls).toHaveLength(1);
    expect(ecsUpdateCalls[0]).toEqual({
      cluster: "test-cluster",
      service: "test-service",
      desiredCount: 0,
    });
  });
});

// ── Lambda handler ──────────────────────────────────────────

describe("lambda handler", () => {
  it("converts Function URL event to yoga request and back", async () => {
    settingsStore.set("live:test-channel", "true");
    const event = makeLambdaEvent("{ live }");
    const result = await handler(event as never);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.data.live).toBe(true);
  });

  it("handles base64-encoded body", async () => {
    const body = JSON.stringify({ query: "{ live }" });
    const event = makeLambdaEvent("{ live }");
    event.body = Buffer.from(body).toString("base64");
    event.isBase64Encoded = true;
    const result = await handler(event as never);
    expect(result.statusCode).toBe(200);
    const parsed = JSON.parse(result.body as string);
    expect(parsed.data.live).toBe(false);
  });

  it("enforces auth through the Lambda path", async () => {
    delete process.env.SKIP_AUTH;
    const event = makeLambdaEvent("{ live }");
    const result = await handler(event as never);
    const body = JSON.parse(result.body as string);
    expect(body.errors).toBeDefined();
    expect(body.data ?? null).toBeNull();
  });

  it("passes auth with a valid token through the Lambda path", async () => {
    delete process.env.SKIP_AUTH;
    const event = makeLambdaEvent("{ live }", undefined, "valid-token");
    const result = await handler(event as never);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.errors).toBeUndefined();
    expect(body.data.live).toBe(false);
  });
});
