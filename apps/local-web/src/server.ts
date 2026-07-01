import { createServer } from "node:http";
import { handleRequest } from "./web-app.ts";

const host = process.env.APP_HOST ?? "127.0.0.1";
const port = Number(process.env.APP_PORT ?? 3000);
const server = createServer(handleRequest);
server.listen(port, host, () => {
  console.log(`ShoppingFlow AI: http://${host}:${port}`);
});
