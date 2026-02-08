import { makeExecutableSchema } from "@graphql-tools/schema";
import { createYoga } from "graphql-yoga";
import { mergedResolvers } from "../src/gql/schema/mergedResolvers.js";
import { mergedTypeDefs } from "../src/gql/schema/mergedTypeDefs.js";

const yoga = createYoga({
  schema: makeExecutableSchema({
    typeDefs: mergedTypeDefs,
    resolvers: mergedResolvers,
  }),
  maskedErrors: false,
});

interface GqlResponse<T = Record<string, unknown>> {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
}

export async function gql<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<GqlResponse<T>> {
  const response = await yoga.fetch("http://localhost/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  return response.json() as Promise<GqlResponse<T>>;
}
