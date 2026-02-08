import { createServer } from "node:http";
import { createYoga } from "graphql-yoga";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { mergedTypeDefs } from "./gql/schema/mergedTypeDefs.js";
import { mergedResolvers } from "./gql/schema/mergedResolvers.js";

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

const server = createServer(yoga);

const PORT = process.env.PORT ?? 4001;
server.listen(PORT, () => {
  console.log(`poker-api running at http://localhost:${PORT}/graphql`);
});
