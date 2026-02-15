import { createServer } from "node:http";
import { createSchema, createYoga } from "graphql-yoga";
import { verifyToken } from "./auth.js";

const PROCTOR_URL = process.env.PROCTOR_URL ?? "http://localhost:4001";
const VIDEOGRAPHER_URL =
  process.env.VIDEOGRAPHER_URL ?? "http://localhost:3001";

// ── Schema ───────────────────────────────────────────────

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type ServiceHealth {
      status: String!
    }

    type Health {
      proctor: ServiceHealth!
      videographer: ServiceHealth!
    }

    type Query {
      health: Health!
      live: Boolean!
    }

    type Mutation {
      setLive(live: Boolean!): Boolean!
      resetDatabase: Boolean!
    }
  `,
  resolvers: {
    Query: {
      health: async () => {
        const [proctor, videographer] = await Promise.all([
          fetchHealth(`${PROCTOR_URL}/health`),
          fetchHealth(`${VIDEOGRAPHER_URL}/health`),
        ]);
        return { proctor, videographer };
      },
      live: async () => {
        const res = await fetch(`${PROCTOR_URL}/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "{ live }" }),
        });
        const json = (await res.json()) as { data?: { live: boolean } };
        return json.data?.live ?? false;
      },
    },
    Mutation: {
      setLive: async (_: unknown, { live }: { live: boolean }) => {
        const res = await fetch(`${PROCTOR_URL}/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "mutation($live: Boolean!) { setLive(live: $live) }",
            variables: { live },
          }),
        });
        const json = (await res.json()) as {
          data?: { setLive: boolean };
        };
        return json.data?.setLive ?? false;
      },
      resetDatabase: async () => {
        const res = await fetch(`${PROCTOR_URL}/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "mutation { resetDatabase }",
          }),
        });
        const json = (await res.json()) as {
          data?: { resetDatabase: boolean };
        };
        return json.data?.resetDatabase ?? false;
      },
    },
  },
});

// ── Helpers ──────────────────────────────────────────────

async function fetchHealth(url: string): Promise<{ status: string }> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { status: "unreachable" };
    return (await res.json()) as { status: string };
  } catch {
    return { status: "unreachable" };
  }
}

// ── Yoga server with JWT auth ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- yoga context typing
const yoga = createYoga<any>({
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

const server = createServer(yoga);

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => {
  console.log(`admin-api running at http://localhost:${PORT}/graphql`);
});
