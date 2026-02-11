import { createServer } from "node:http";
import { join } from "node:path";
import { makeExecutableSchema } from "@graphql-tools/schema";
import dotenv from "dotenv";
import { createYoga } from "graphql-yoga";

dotenv.config({ path: join(import.meta.dirname, "../../../.env") });

import { mergedResolvers } from "./gql/schema/mergedResolvers.js";
import { mergedTypeDefs } from "./gql/schema/mergedTypeDefs.js";
import { getSession } from "./services/session/session-manager.js";

const yoga = createYoga({
  schema: makeExecutableSchema({
    typeDefs: mergedTypeDefs,
    resolvers: mergedResolvers,
  }),
  context: ({ request }) => ({
    playerId: request.headers.get("x-player-id"),
  }),
  graphiql: true,
});

export { yoga };

const CHANNEL_KEY = "poker-stream-1";

const server = createServer((req, res) => {
  if (req.url === "/health") {
    const session = getSession(CHANNEL_KEY);
    const body = JSON.stringify({
      status: "ok",
      session: session
        ? {
            channelKey: session.channelKey,
            status: session.status,
            handNumber: session.handNumber,
          }
        : null,
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(body);
    return;
  }
  yoga(req, res);
});

const PORT = process.env.PORT ?? 4001;
server.listen(PORT, () => {
  console.log(`proctor-api running at http://localhost:${PORT}/graphql`);
});
