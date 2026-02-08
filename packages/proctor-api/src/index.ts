import { createServer } from "node:http";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { createYoga } from "graphql-yoga";
import { mergedResolvers } from "./gql/schema/mergedResolvers.js";
import { mergedTypeDefs } from "./gql/schema/mergedTypeDefs.js";

const yoga = createYoga({
  schema: makeExecutableSchema({
    typeDefs: mergedTypeDefs,
    resolvers: mergedResolvers,
  }),
  graphiql: true,
});

export { yoga };

const server = createServer(yoga);

const PORT = process.env.PORT ?? 4002;
server.listen(PORT, () => {
  console.log(`proctor-api running at http://localhost:${PORT}/graphql`);
});
