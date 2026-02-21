import { createServer } from "node:http";
import { yoga } from "./yoga.js";

const server = createServer(yoga);

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => {
  console.log(`admin-api running at http://localhost:${PORT}/graphql`);
});
