import type { CodegenConfig } from "@graphql-codegen/cli";
import { allTypeDefs } from "../proctor-api/src/gql/schema/mergedTypeDefs.js";

const config: CodegenConfig = {
  schema: allTypeDefs,
  documents: "src/graphql/operations.ts",
  watch: [
    "src/graphql/operations.ts",
    "../proctor-api/src/gql/schema/**/typeDefs.ts",
  ],
  generates: {
    "src/graphql/generated.ts": {
      plugins: ["typescript", "typescript-operations"],
      config: {
        enumsAsTypes: true,
        avoidOptionals: true,
      },
    },
  },
};

export default config;
