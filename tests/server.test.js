import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";
const port = 3187,
  origin = `http://127.0.0.1:${port}`;
let proc;
const clients = [];
before(async () => {
  proc = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error("Server did not start")),
      5000,
    );
    proc.stdout.on("data", () => {
      clearTimeout(timeout);
      resolve();
    });
    proc.once("error", reject);
  });
});
after(() => {
  clients.forEach((c) => c.ws.terminate());
  proc?.kill();
});
async function client(options = {}) {
  const ws = new WebSocket(origin.replace("http", "ws"), options);
  const c = { ws, state: null, session: null, messages: [], waiters: [] };
  clients.push(c);
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    c.messages.push(m);
    if (m.type === "state") c.state = m.state;
    if (m.type === "session") c.session = m;
    for (const w of [...c.waiters])
      if (w.predicate(m)) {
        clearTimeout(w.timeout);
        c.waiters = c.waiters.filter((x) => x !== w);
        w.resolve(m);
      }
  });
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  c.wait = (predicate) =>
    new Promise((resolve, reject) => {
      const w = {
        predicate,
        resolve,
        timeout: setTimeout(() => {
          c.waiters = c.waiters.filter((x) => x !== w);
          reject(Error("Message timeout"));
        }, 4000),
      };
      c.waiters.push(w);
    });
  c.send = async (message, predicate = (m) => m.type === "state") => {
    const p = c.wait(predicate);
    ws.send(JSON.stringify(message));
    return p;
  };
  return c;
}
test("health, PWA, public modules and traversal protection", async () => {
  const health = await fetch(origin + "/health").then((r) => r.json());
  assert.equal(health.ok, true);
  for (const path of [
    "/",
    "/sw.js",
    "/manifest.webmanifest",
    "/shared/cards.js",
    "/assets/icon-192.png",
  ])
    assert.equal((await fetch(origin + path)).status, 200, path);
  for (const path of [
    "/shared/..%2fserver/index.js",
    "/shared/..%2fpackage.json",
    "/shared/..%2f.env",
  ])
    assert.equal((await fetch(origin + path)).status, 403, path);
});
test("room lifecycle, authorization, disconnect, consensual host transfer and private reconnect", async () => {
  const a = await client();
  await a.send({ type: "create", name: "Avery" });
  const code = a.state.code;
  const peers = [a];
  for (const name of ["Maya", "Rowan", "Jules"]) {
    const c = await client();
    await c.send({ type: "join", name, code });
    peers.push(c);
  }
  const [b, c, d] = peers.slice(1);
  assert.equal(d.state.players.length, 4);
  const error = await b.send({ type: "start" }, (m) => m.type === "error");
  assert.match(error.message, /host/);
  await a.send(
    {
      type: "reorder",
      ids: [
        a.session.playerId,
        c.session.playerId,
        b.session.playerId,
        d.session.playerId,
      ],
    },
    (m) => m.type === "state" && m.state.players[1].id === c.session.playerId,
  );
  await a.send(
    { type: "start" },
    (m) => m.type === "state" && m.state.stage === "draft1",
  );
  assert.equal(a.state.stage, "draft1");
  for (const p of peers) {
    if (!p.state?.me?.draft.length)
      await p.wait((m) => m.type === "state" && m.state.stage === "draft1");
    assert.equal(p.state.me.draft.length, 3);
    assert.ok(
      p.state.players
        .filter((t) => t.id !== p.session.playerId)
        .every((t) => t.identity === null && !("hand" in t)),
    );
  }
  const oldSession = {
    code,
    playerId: a.session.playerId,
    secret: a.session.secret,
  };
  const pause = b.wait((m) => m.type === "state" && m.state.paused);
  a.ws.close();
  await pause;
  const rejected = await b.send(
    {
      type: "action",
      action: { type: "draft", cardId: b.state.me.draft[0].id },
    },
    (m) => m.type === "error",
  );
  assert.match(rejected.message, /paused/);
  await b.send(
    { type: "continue" },
    (m) => m.type === "state" && m.state.votes.includes(b.session.playerId),
  );
  assert.equal(b.state.paused, true);
  await c.send(
    { type: "continue" },
    (m) => m.type === "state" && m.state.votes.includes(c.session.playerId),
  );
  assert.equal(c.state.paused, true);
  await d.send(
    { type: "continue" },
    (m) => m.type === "state" && !m.state.paused,
  );
  assert.equal(d.state.paused, false);
  const expected = c.session.playerId; // First online player in the reordered seat list.
  assert.equal(d.state.hostId, expected);
  const resumed = await client();
  await resumed.send({ type: "resume", ...oldSession });
  assert.equal(resumed.state.hostId, expected);
  assert.equal(resumed.state.me.draft.length, 3);
  const impostor = await client();
  const expired = await impostor.send(
    { type: "resume", ...oldSession, secret: "invalid" },
    (m) => m.type === "sessionExpired",
  );
  assert.equal(expired.type, "sessionExpired");
  await resumed.send(
    { type: "rename", name: "Avery II" },
    (m) =>
      m.type === "state" &&
      m.state.players.find((p) => p.id === oldSession.playerId).name ===
        "Avery II",
  );
  assert.equal(
    resumed.state.players.find((p) => p.id === oldSession.playerId).name,
    "Avery II",
  );
});
test("cross-origin WebSockets are rejected", async () => {
  const ws = new WebSocket(origin.replace("http", "ws"), {
    origin: "https://unrelated.example",
  });
  const code = await new Promise((resolve, reject) => {
    ws.on("close", resolve);
    ws.on("error", reject);
  });
  assert.equal(code, 1008);
});
test("hosted Same Wi-Fi action creates a joinable coded court in one request", async () => {
  const host = await client({
    headers: { Host: "heir.example.com" },
    origin: "https://heir.example.com",
  });
  await host.send({ type: "create", name: "Guest", playMode: "same-wifi" });
  assert.match(host.state.code, /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(host.state.playMode, "same-wifi");
  assert.equal(host.state.mode, "internet");
  assert.equal(host.state.inviteOrigin, null);
  const guest = await client();
  await guest.send({ type: "join", name: "Maya", code: host.state.code });
  assert.equal(guest.state.players.length, 2);
  assert.equal(guest.state.playMode, "same-wifi");
});
test("LAN mode serves the same game and advertises local host addresses", async () => {
  const local = spawn(process.execPath, ["server/index.js", "--lan"], {
    env: { ...process.env, PORT: "3188" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error("LAN server did not start")),
        5000,
      );
      local.stdout.once("data", () => {
        clearTimeout(timeout);
        resolve();
      });
      local.once("error", reject);
    });
    const health = await fetch("http://127.0.0.1:3188/health").then((r) =>
      r.json(),
    );
    const config = await fetch("http://127.0.0.1:3188/api/config").then((r) =>
      r.json(),
    );
    assert.equal(health.mode, "lan");
    assert.equal(config.mode, "lan");
    assert.ok(Array.isArray(config.lanAddresses));
    assert.ok(
      config.lanAddresses.every(
        (url) => url.startsWith("http://") && url.endsWith(":3188"),
      ),
    );
    assert.equal((await fetch("http://127.0.0.1:3188/")).status, 200);
  } finally {
    local.kill();
  }
});

test('host resolves offline seats, rejects rejoin, and abandons for everyone', async () => {
  const host=await client(); await host.send({type:'create',name:'Host'});
  const peers=[];
  for(let i=0;i<4;i++){const c=await client();await c.send({type:'join',code:host.session.code,name:'Guest'+i});peers.push(c);}
  await host.send({type:'start'});
  const rejected=await peers[0].send({type:'abandon'},m=>m.type==='error'); assert.match(rejected.message,/host/i);
  const saved=peers[3].session;const offline=host.wait(m=>m.type==='state'&&m.state.players.some(p=>p.id===saved.playerId&&!p.online));peers[3].ws.close();await offline;
  await host.send({type:'depart-seat',playerId:saved.playerId});assert.equal(host.state.players.find(p=>p.id===saved.playerId).departed,true);
  const retry=await client();await retry.send({...saved,type:'resume'},m=>m.type==='sessionExpired');
  await host.send({type:'abandon'});assert.equal(host.state.stage,'abandoned');
  await host.send({type:'rematch'});assert.equal(host.state.stage,'lobby');assert.equal(host.state.players.length,4);
});
