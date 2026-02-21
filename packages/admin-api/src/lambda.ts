import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { yoga } from "./yoga.js";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
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
