import {
  BatchWriteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import docClient, { tableNames } from "./db.js";

// ── Modules ────────────────────────────────────────────────

export interface Module {
  moduleId: string;
  type: string;
  progIndex: number;
  status: "running" | "completed";
  createdAt: number;
}

export async function createModule(
  moduleId: string,
  type: string,
  progIndex: number,
): Promise<Module> {
  const createdAt = Date.now();
  const item: Module = {
    moduleId,
    type,
    progIndex,
    status: "running",
    createdAt,
  };
  await docClient.send(
    new PutCommand({ TableName: tableNames.modules, Item: item }),
  );
  return item;
}

export async function getModule(moduleId: string): Promise<Module | undefined> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableNames.modules,
      Key: { moduleId },
    }),
  );
  return result.Item as Module | undefined;
}

export async function completeModule(moduleId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: tableNames.modules,
      Key: { moduleId },
      UpdateExpression: "SET #s = :s",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": "completed" },
    }),
  );
}

// ── Instructions ───────────────────────────────────────────

export interface Instruction {
  moduleId: string;
  timestampMs: number;
  type: string;
  payload: string;
}

export async function insertInstruction(
  moduleId: string,
  timestampMs: number,
  type: string,
  payload: object,
  stateSnapshot: string | null = null,
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: tableNames.instructions,
      Item: {
        moduleId,
        timestampMs,
        type,
        payload: JSON.stringify(payload),
        stateSnapshot: stateSnapshot ?? undefined,
      },
    }),
  );
}

export async function getInstructions(
  moduleId: string,
  afterTimestampMs?: number,
): Promise<Instruction[]> {
  const params: {
    TableName: string;
    KeyConditionExpression: string;
    ExpressionAttributeValues: Record<string, unknown>;
    ScanIndexForward: boolean;
    ProjectionExpression: string;
  } = {
    TableName: tableNames.instructions,
    KeyConditionExpression:
      afterTimestampMs != null
        ? "moduleId = :mid AND timestampMs > :ts"
        : "moduleId = :mid",
    ExpressionAttributeValues:
      afterTimestampMs != null
        ? { ":mid": moduleId, ":ts": afterTimestampMs }
        : { ":mid": moduleId },
    ScanIndexForward: true,
    ProjectionExpression: "moduleId, timestampMs, #t, payload",
  };

  const result = await docClient.send(
    new QueryCommand({
      ...params,
      ExpressionAttributeNames: { "#t": "type" },
    }),
  );

  return (result.Items ?? []) as Instruction[];
}

export async function getLatestInstruction(
  moduleId: string,
): Promise<Instruction | undefined> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableNames.instructions,
      KeyConditionExpression: "moduleId = :mid",
      ExpressionAttributeValues: { ":mid": moduleId },
      ExpressionAttributeNames: { "#t": "type" },
      ProjectionExpression: "moduleId, timestampMs, #t, payload",
      ScanIndexForward: false,
      Limit: 1,
    }),
  );

  const items = result.Items ?? [];
  return items.length > 0 ? (items[0] as Instruction) : undefined;
}

// ── Channel State ──────────────────────────────────────────

export interface ChannelState {
  channelKey: string;
  moduleId: string;
  instructionTs: number | null;
  stateSnapshot: string | null;
  ackedInstructionTs: number | null;
}

export async function getChannelState(
  channelKey: string,
): Promise<ChannelState | undefined> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableNames.channelState,
      Key: { channelKey },
    }),
  );

  if (!result.Item) return undefined;

  const item = result.Item;
  return {
    channelKey: item.channelKey as string,
    moduleId: item.moduleId as string,
    instructionTs: (item.instructionTs as number) ?? null,
    stateSnapshot: (item.stateSnapshot as string) ?? null,
    ackedInstructionTs: (item.ackedInstructionTs as number) ?? null,
  };
}

export async function upsertChannelState(
  channelKey: string,
  moduleId: string,
  instructionTs: number | null = null,
  stateSnapshot: string | null = null,
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: tableNames.channelState,
      Item: {
        channelKey,
        moduleId,
        instructionTs,
        stateSnapshot,
      },
    }),
  );
}

export async function ackInstruction(
  channelKey: string,
  instructionTs: number,
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: tableNames.channelState,
      Key: { channelKey },
      UpdateExpression: "SET ackedInstructionTs = :ts",
      ExpressionAttributeValues: { ":ts": instructionTs },
    }),
  );
}

export async function getInstructionSnapshot(
  moduleId: string,
  timestampMs: number,
): Promise<string | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableNames.instructions,
      Key: { moduleId, timestampMs },
      ProjectionExpression: "stateSnapshot",
    }),
  );

  return (result.Item?.stateSnapshot as string) ?? null;
}

// ── Agent Messages ─────────────────────────────────────────

export interface AgentMessage {
  moduleId: string;
  playerId: string;
  role: string;
  content: string;
  seq: number;
}

export async function appendAgentMessage(
  moduleId: string,
  playerId: string,
  role: string,
  content: string,
): Promise<void> {
  const pk = `${moduleId}#${playerId}`;

  // Find the current max seq
  const queryResult = await docClient.send(
    new QueryCommand({
      TableName: tableNames.agentMessages,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
      ScanIndexForward: false,
      Limit: 1,
      ProjectionExpression: "seq",
    }),
  );

  const maxSeq =
    queryResult.Items && queryResult.Items.length > 0
      ? (queryResult.Items[0].seq as number)
      : -1;
  const nextSeq = maxSeq + 1;

  await docClient.send(
    new PutCommand({
      TableName: tableNames.agentMessages,
      Item: {
        pk,
        seq: nextSeq,
        moduleId,
        playerId,
        role,
        content,
      },
    }),
  );
}

export async function getAgentMessages(
  moduleId: string,
  playerId: string,
): Promise<AgentMessage[]> {
  const pk = `${moduleId}#${playerId}`;

  const result = await docClient.send(
    new QueryCommand({
      TableName: tableNames.agentMessages,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": pk },
      ScanIndexForward: true,
      ProjectionExpression: "moduleId, playerId, #r, content, seq",
      ExpressionAttributeNames: { "#r": "role" },
    }),
  );

  return (result.Items ?? []) as AgentMessage[];
}

// ── Settings ──────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | undefined> {
  const result = await docClient.send(
    new GetCommand({
      TableName: tableNames.settings,
      Key: { key },
      ProjectionExpression: "#v",
      ExpressionAttributeNames: { "#v": "value" },
    }),
  );

  return result.Item?.value as string | undefined;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: tableNames.settings,
      Item: { key, value },
    }),
  );
}

// ── Reset Database ──────────────────────────────────────

/** Delete all items from game data tables (preserves settings). */
export async function resetDatabase(): Promise<void> {
  const tableKeys: { table: string; keys: string[] }[] = [
    { table: tableNames.modules, keys: ["moduleId"] },
    { table: tableNames.instructions, keys: ["moduleId", "timestampMs"] },
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
      // BatchWrite supports up to 25 items per call
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
}
