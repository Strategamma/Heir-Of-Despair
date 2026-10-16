// Development-only peers for exercising the real multiplayer UI; not shipped to browsers.
import { WebSocket } from "ws";
import { CARD_MAP, categoryIndex } from "../shared/cards.js";
const [origin = "http://localhost:4178", code, count = "3"] =
  process.argv.slice(2);
if (!code)
  throw Error(
    "Usage: node scripts/court-companions.js http://localhost:4178 CODE [count]",
  );
const peers = [];
for (let i = 0; i < Number(count); i++) {
  const ws = new WebSocket(origin.replace(/^http/, "ws"));
  const peer = { ws, last: null };
  peers.push(peer);
  ws.on("open", () =>
    ws.send(
      JSON.stringify({
        type: "join",
        code,
        name: [
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
      }),
    ),
  );
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.type === "error") console.log(m.message);
    if (m.type !== "state") return;
    const s = m.state;
    if (s.paused) return;
    const key = s.stage.startsWith("draft")
      ? `${s.night}-${s.stage}`
      : s.prompt?.id;
    if (!key || key === peer.last) return;
    let action;
    if (s.stage.startsWith("draft") && !s.me.selected)
      action = { type: "draft", cardId: s.me.draft[0].id };
    else if (s.prompt) {
      const q = s.prompt,
        c = CARD_MAP[q.cardId];
      action = { promptId: q.id };
      if (q.kind === "target")
        action.targets = s.players
          .filter(
            (p) =>
              (["usurper", "justiciar"].includes(q.cardId) || ["Cutthroat", "King’s Blade"].includes(c.type) || p.id !== s.me.id) &&
              (!(
                c.type === "Cutthroat" ||
                c.type === "King’s Blade" ||
                q.cardId === "justiciar"
              ) ||
                p.alive) &&
              (q.cardId !== "thief" || p.sealCount > s.me.tokens.length),
          )
          .slice(0, q.count)
          .map((p) => p.id);
      else if (q.kind === "inspect")
        action.choice =
          q.cardId === "usurper"
            ? "swap"
            : q.cardId === "herald"
              ? "reveal"
              : c.type === "King’s Blade"
                ? "kill"
                : "done";
      else if (q.kind === "recover") action.cardId = q.options[0];
      else if (q.kind === "recovered")
        action.choice = categoryIndex(q.cardId) < 0 ? "save" : "now";
      else if (q.kind === "react") action.choice = q.options[0];
      else if (q.kind === "steal") action.tokenId = q.options[0];
      else if (q.kind === "brokerInspect") action.choice = "identity";
      else if (q.kind === "exchange") action.choice = "done";
    }
    if (action) {
      peer.last = key;
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: "action", action }));
      }, 600);
    }
  });
}
console.log(
  `Joining ${count} development peers to ${code}. Stop this process to disconnect them.`,
);
process.on("SIGINT", () => {
  peers.forEach((p) => p.ws.close());
  process.exit();
});
