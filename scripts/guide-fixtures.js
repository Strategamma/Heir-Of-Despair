// Development-only current-UI screenshot fixture. Never imported by production.
import http from "node:http";
import { CARD_MAP } from "../shared/cards.js";
import { readFileSync } from "node:fs";
import { WebSocketServer } from "ws";
import {
  newPlayer,
  createGame,
  startNight,
  viewFor,
  scoreNight,
} from "../server/game.js";
const ps = Array.from(
  { length: Number(process.env.GUIDE_PLAYERS || 10) },
  (_, i) =>
    newPlayer(
      [
        "Avery",
        "Maya",
        "Rowan",
        "Jules",
        "Sam",
        "Robin",
        "Kai",
        "Rhea",
        "Morgan",
        "Ellis",
      ][i],
    ),
);
const g = createGame(ps, ps[0].id);
g.code = "CROWN";
g.mode = "internet";
startNight(g);
const variants = {};
const lobby = structuredClone(g);
lobby.stage = "lobby";
variants.lobby = viewFor(lobby, ps[0].id);
ps[0].knownIdentity = { house: "ashthorn", rank: 1 };
variants.identity = viewFor(g, ps[0].id);
variants.draft = structuredClone(variants.identity);
variants.draft.stage = "draft2";
variants.draft.me.draft = variants.draft.me.draft.slice(0, 2);
variants.draft.me.kept = [variants.identity.me.draft[2]];
g.stage = "night";
g.phase = 0;
g.players.forEach((p, i) => {
  p.draft = [];
  p.hand = i === 0 ? ["mirror"] : ["blade-2"];
  p.selected = false;
  p.played = i === 0 ? ["informant-1"] : i === 1 ? ["informant-2"] : [];
});
g.prompt = {
  id: "qa",
  playerId: ps[0].id,
  kind: "target",
  cardId: "informant-1",
  count: 1,
};
g.activeCard = { playerId: ps[0].id, cardId: "informant-1" };
g.cardStates = {
  [`${ps[0].id}:informant-1`]: "playing",
  [`${ps[1].id}:informant-2`]: "waiting",
};
variants.phase = viewFor(g, ps[0].id);
variants.hand = structuredClone(variants.phase);
variants.hand.me.hand = [CARD_MAP["blade-1"], CARD_MAP.mirror];
variants.hand.players[0].played = [];
variants.hand.prompt = null;
variants.hand.activeCard = { playerId: ps[1].id, cardId: "informant-2" };
variants.hand.activePlayerId = ps[1].id;
variants.hand.players[1].played.forEach((c) => (c.status = "playing"));
variants.phaseCall = structuredClone(variants.phase);
variants.phaseCall.presentation = { kind: "phase" };
variants.phaseCall.activeCard = null;
variants.phaseCall.prompt = null;
variants.phaseCall.activePlayerId = null;
variants.phaseCall.players.forEach((p) =>
  p.played.forEach((c) => (c.status = "waiting")),
);
variants.fallen = structuredClone(variants.phase);
variants.fallen.players[1].alive = false;
variants.fallen.players[1].played.forEach((c) => (c.status = "skipped"));
variants.fallen.log.push("Maya has fallen.");
g.prompt = {
  id: "react",
  playerId: ps[0].id,
  kind: "react",
  cardId: "blade-2",
  attackerId: ps[1].id,
  targetId: ps[0].id,
  options: ["mirror"],
};
g.activeCard = { playerId: ps[1].id, cardId: "blade-2" };
variants.reaction = viewFor(g, ps[0].id);
ps[1].alive = false;
if (ps[4]) ps[4].alive = false;
g.prompt = null;
scoreNight(g);
variants.dawn = viewFor(g, ps[0].id);
g.stage = "victory";
g.winners = [ps[0].id, ps[2].id];
variants.victory = viewFor(g, ps[0].id);

variants.victory.me.tokens = Array.from({ length: 4 }, (_, i) => ({
  id: `seal-${i}`,
  value: 3,
}));
variants.victory.me.prestige = 12;
variants.victory.players
  .filter((p) => variants.victory.winners.includes(p.id))
  .forEach((p) => {
    p.sealCount = 4;
    p.prestige = 12;
  });

for (const chosenHouse of ["ashthorn", "stormwing", "unsworn"]) {
  const people = [
    "Avery",
    "Maya",
    "Rowan",
    "Jules",
    ...(chosenHouse === "unsworn" ? ["Quinn"] : []),
  ].map(newPlayer);
  const demo = createGame(people, people[0].id);
  demo.code = "CROWN";
  demo.mode = "internet";
  demo.night = 1;
  demo.stage = "night";
  const winnerHouse = chosenHouse === "unsworn" ? "ashthorn" : chosenHouse;
  const rivalHouse = winnerHouse === "ashthorn" ? "stormwing" : "ashthorn";
  people.forEach((p, i) => {
    p.identity =
      i === 4
        ? { house: "unsworn", rank: null }
        : { house: i % 2 ? winnerHouse : rivalHouse, rank: i < 2 ? 2 : 1 };
    p.knownIdentity = { ...p.identity };
  });
  people[1].alive = false;
  const maker = people[chosenHouse === "unsworn" ? 4 : 3];
  maker.hand = ["kingmaker"];
  scoreNight(demo);
  variants["kingmaker-" + chosenHouse] = viewFor(demo, people[0].id);
  if (chosenHouse === "ashthorn") {
    const final = structuredClone(variants["kingmaker-ashthorn"]);
    final.stage = "victory";
    final.winners = [people[3].id];
    final.players.forEach((p, i) => {
      p.prestige =
        i === 3 ? 12 : people[i].tokens.reduce((s, t) => s + t.value, 0);
      if (i === 3) p.sealCount = 4;
    });
    variants.kingmakerFinal = final;
  }
}
const server = http.createServer(async (req, res) => {
  if (req.url === "/sw.js") {
    res.writeHead(404);
    res.end();
    return;
  }
  const upstream = await fetch("http://localhost:4178" + req.url);
  res.writeHead(upstream.status, {
    "content-type": upstream.headers.get("content-type") || "text/plain",
  });
  res.end(Buffer.from(await upstream.arrayBuffer()));
});
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  const publish = () => {
    const kind = readFileSync("/tmp/heir-guide-scene", "utf8").trim();
    ws.send(
      JSON.stringify({
        type: "state",
        state: variants[kind] || variants.phase,
      }),
    );
  };
  ws.on("message", publish);
  publish();
});
server.listen(4179, "127.0.0.1", () => console.log("Guide fixtures on 4179"));
