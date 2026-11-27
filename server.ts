// One Node process serves the Next.js pages and the live Socket.io game server.
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { attachGameServer } from "./src/server/game-server";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    // Quizzes can carry pictures, so allow bigger messages than the 1 MB default.
    maxHttpBufferSize: 20 * 1024 * 1024,
    pingInterval: 10000,
    pingTimeout: 8000,
  });
  attachGameServer(io);

  httpServer.listen(port, hostname, () => {
    console.log(`> Dash is running on http://localhost:${port}`);
  });
});
