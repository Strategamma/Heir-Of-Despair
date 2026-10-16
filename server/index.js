import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { networkInterfaces } from "node:os";
import { randomInt, timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import {
  departSeat,
  abandonGame,
  createGame,
  newPlayer,
  startNight,
  act,
  viewFor,
  advancePresentation,
} from "./game.js";
import { lanAddresses, roomConnection } from "./network.js";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.PORT || 3000);
const mode =
  process.argv.includes("--lan") || process.env.TABLE_MODE === "lan"
    ? "lan"
    : "internet";
const rooms = new Map();
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};
const addresses = () => lanAddresses(networkInterfaces(), port);
const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  );
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" }).end(
      JSON.stringify({
        ok: true,
        game: "heir-of-despair",
        version: "0.1.0",
        mode,
      }),
    );
    return;
  }
  if (pathname === "/api/config") {
    res
      .writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      })
      .end(
        JSON.stringify({
          mode,
          lanAddresses: mode === "lan" ? addresses() : [],
          restartRecovery: false,
        }),
      );
    return;
  }
  const shared = pathname.startsWith("/shared/");
  const base = resolve(root, shared ? "shared" : "public");
  const relative = shared ? pathname.slice("/shared".length) : pathname;
  const path = resolve(
    base,
    "." + (relative === "/" ? "/index.html" : relative),
  );
  if (!path.startsWith(base + "/") || pathname.includes("\0")) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(path);
    res
      .writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
        "Cache-Control":
          pathname === "/sw.js" ? "no-cache" : "public, max-age=0",
      })
      .end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
const wss = new WebSocketServer({ server, maxPayload: 8192 });
const send = (ws, data) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
};
function broadcast(g) {
  g.updatedAt = Date.now();
  for (const p of g.players)
    if (p.socket) send(p.socket, { type: "state", state: viewFor(g, p.id) });
}
function seat(ws) {
  const g = rooms.get(ws.code),
    p = g?.players.find((p) => p.id === ws.playerId);
  if (!p || p.socket !== ws) throw Error("Reconnect to your court.");
  return [g, p];
}
function authorizeHost(g, p) {
  if (g.hostId !== p.id) throw Error("Only the host can do that.");
}
function nameOf(value) {
  if (typeof value !== "string") throw Error("Enter a name.");
  const name = value.trim();
  if (!name || name.length > 32 || /[\x00-\x1f\x7f]/.test(name))
    throw Error("Use a name of 1–32 readable characters.");
  return name;
}
function connect(ws, g, p) {
  if (p.socket && p.socket !== ws) {
    const old = p.socket;
    old.playerId = null;
    send(old, { type: "replaced" });
    old.close(4001, "Seat reopened elsewhere");
  }
  p.socket = ws;
  p.online = true;
  ws.code = g.code;
  ws.playerId = p.id;
  send(ws, { type: "session", code: g.code, playerId: p.id, secret: p.secret });
  if (g.hostId === p.id && g.paused) {
    g.paused = false;
    g.votes = [];
  }
  if (g.paused && !g.players.find((t) => t.id === g.hostId)?.online)
    g.votes = g.votes.filter((id) =>
      g.players.some((p) => p.id === id && p.online),
    );
  broadcast(g);
}
wss.on("connection", (ws, req) => {
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        ws.close(1008, "Origin denied");
        return;
      }
    } catch {
      ws.close(1008);
      return;
    }
  }
  ws.alive = true;
  ws.on("pong", () => (ws.alive = true));
  let count = 0,
    start = Date.now();
  ws.on("message", (raw) => {
    if (Date.now() - start > 10000) {
      count = 0;
      start = Date.now();
    }
    if (++count > 100) {
      ws.close(1008, "Too many requests");
      return;
    }
    try {
      const m = JSON.parse(raw.toString());
      if (!m || typeof m.type !== "string") throw Error("Invalid request.");
      if (m.type === "create") {
        if (ws.playerId) throw Error("Leave your current court first.");
        if (rooms.size >= 500)
          throw Error("The palace is busy. Try again shortly.");
        const playMode =
          m.playMode ?? (mode === "lan" ? "same-wifi" : "internet");
        if (!["same-wifi", "internet"].includes(playMode))
          throw Error("Choose Internet or Same Wi-Fi play.");
        const connection = roomConnection({
          host: req.headers.host,
          configuredMode: mode,
          playMode,
          addresses: addresses(),
        });
        const p = newPlayer(nameOf(m.name)),
          alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code;
        do {
          code = Array.from(
            { length: 5 },
            () => alphabet[randomInt(alphabet.length)],
          ).join("");
        } while (rooms.has(code));
        const g = createGame([p], p.id);
        g.paced = true;
        Object.assign(g, {
          code,
          playMode,
          ...connection,
          updatedAt: Date.now(),
        });
        rooms.set(code, g);
        connect(ws, g, p);
        return;
      }
      if (m.type === "join") {
        if (ws.playerId) throw Error("Leave your current court first.");
        const g = rooms.get(String(m.code).trim().toUpperCase());
        if (!g)
          throw Error("Court not found. Check the code and connection mode.");
        if (!["lobby", "abandoned"].includes(g.stage))
          throw Error(
            "This court has already begun. Rejoin your existing seat instead.",
          );
        if (g.players.length >= 10) throw Error("This court is full.");
        const p = newPlayer(nameOf(m.name));
        g.players.push(p);
        connect(ws, g, p);
        return;
      }
      if (m.type === "resume") {
        const g = rooms.get(m.code),
          p = g?.players.find((p) => p.id === m.playerId);
        const valid =
          p && !p.departed &&
          typeof m.secret === "string" &&
          m.secret.length === p.secret.length &&
          timingSafeEqual(Buffer.from(m.secret), Buffer.from(p.secret));
        if (!valid) {
          send(ws, { type: "sessionExpired" });
          return;
        }
        connect(ws, g, p);
        return;
      }
      const [g, p] = seat(ws);
      if (m.type === "start") {
        authorizeHost(g, p);
        if (g.paused) throw Error("Resume the court first.");
        startNight(g);
      } else if (m.type === "action") act(g, p.id, m.action);
      else if (m.type === "rename") {
        p.name = nameOf(m.name);
      } else if (m.type === "reorder") {
        authorizeHost(g, p);
        if (g.stage !== "lobby") throw Error("Seats are locked.");
        if (
          !Array.isArray(m.ids) ||
          m.ids.length !== g.players.length ||
          new Set(m.ids).size !== g.players.length ||
          m.ids.some((id) => !g.players.some((p) => p.id === id))
        )
          throw Error("Invalid seating order.");
        g.players = m.ids.map((id) => g.players.find((p) => p.id === id));
      } else if (m.type === "continue") {
        if (!g.paused || g.players.find((p) => p.id === g.hostId)?.online)
          throw Error("No host transfer is pending.");
        if (!g.votes.includes(p.id)) g.votes.push(p.id);
        const online = g.players.filter((p) => p.online);
        if (online.length && online.every((p) => g.votes.includes(p.id))) {
          g.hostId = online[0].id;
          g.paused = false;
          g.votes = [];
        }
      } else if (m.type === "depart-seat") {
        authorizeHost(g, p);
        departSeat(g, m.playerId);
      } else if (m.type === "abandon") {
        authorizeHost(g, p);
        abandonGame(g);
      } else if (m.type === "rematch") {
        authorizeHost(g, p);
        if (!["victory", "abandoned"].includes(g.stage)) throw Error("Finish this match first.");
        g.players = g.players.filter((t) => !t.departed && (g.stage !== "abandoned" || t.online));
        for (const t of g.players)
          Object.assign(t, {
            tokens: [],
            hand: [],
            played: [],
            identity: null,
            knownIdentity: null,
            publicIdentity: false,
            knowledge: [],
            alive: true,
            selected: false,
          });
        Object.assign(g, {
          stage: "lobby",
          night: 0,
          result: null,
          winners: [],
          prompt: null,
          log: [],
          phase: -1,
        });
      } else if (m.type === "leave") {
        if (g.stage !== "lobby")
          throw Error(
            "Your seat is reserved until this match ends. Close the game to disconnect.",
          );
        g.players = g.players.filter((t) => t.id !== p.id);
        ws.playerId = null;
        p.socket = null;
        if (g.hostId === p.id) {
          g.hostId = g.players.find((t) => t.online)?.id ?? g.players[0]?.id;
          g.paused = false;
        }
        if (!g.players.length) rooms.delete(g.code);
        send(ws, { type: "left" });
      } else throw Error("Unknown request.");
      g.revision++;
      broadcast(g);
    } catch (e) {
      send(ws, {
        type: "error",
        message: e.message || "Could not complete that action.",
      });
    }
  });
  ws.on("close", () => {
    const g = rooms.get(ws.code),
      p = g?.players.find((p) => p.id === ws.playerId);
    if (!p || p.socket !== ws) return;
    p.online = false;
    p.socket = null;
    g.votes = g.votes.filter((id) => id !== p.id);
    if (g.hostId === p.id && g.stage !== "abandoned") {
      g.paused = true;
      g.votes = [];
    }
    broadcast(g);
  });
});
setInterval(() => {
  for (const g of rooms.values()) if (advancePresentation(g)) broadcast(g);
}, 100).unref();
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
  for (const [code, g] of rooms)
    if (
      g.players.every((p) => !p.online) &&
      Date.now() - g.updatedAt > 2 * 60 * 60 * 1000
    )
      rooms.delete(code);
}, 30000).unref();
server.listen(port, "0.0.0.0", () =>
  console.log(
    `Heir of Despair · ${mode} · http://localhost:${port}${mode === "lan" ? " · " + addresses().join(" · ") : ""}`,
  ),
);
