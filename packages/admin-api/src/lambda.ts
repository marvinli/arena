import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { executeScheduledAction } from "./scheduler.js";
import { yoga } from "./yoga.js";

interface SchedulerEvent {
  source: "arena-scheduler";
  action: string;
}

function isSchedulerEvent(event: unknown): event is SchedulerEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    (event as Record<string, unknown>).source === "arena-scheduler" &&
    typeof (event as Record<string, unknown>).action === "string"
  );
}

export async function handler(
  event: APIGatewayProxyEventV2 | SchedulerEvent,
): Promise<APIGatewayProxyResultV2> {
  // Scheduler events (IAM-invoked, no auth needed)
  if (isSchedulerEvent(event)) {
    try {
      await executeScheduledAction(event.action);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { statusCode: 400, body: JSON.stringify({ error: message }) };
    }
  }

  const { rawPath, rawQueryString, headers, body, isBase64Encoded } = event;
  const method = event.requestContext.http.method;

  const url = `https://${headers.host ?? "localhost"}${rawPath}${rawQueryString ? `?${rawQueryString}` : ""}`;

  const requestHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value) requestHeaders.set(key, value);
  }

  const request = new Request(url, {
    method,
    headers: requestHeaders,
    body:
      method !== "GET" && method !== "HEAD"
        ? isBase64Encoded
          ? Buffer.from(body ?? "", "base64").toString()
          : body
        : undefined,
  });

  const response = await yoga.fetch(request);

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    statusCode: response.status,
    headers: responseHeaders,
    body: await response.text(),
    isBase64Encoded: false,
  };
}
