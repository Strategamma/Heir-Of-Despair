import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, CARD_MAP, categoryIndex } from "../shared/cards.js";
import {
  newPlayer,
  createGame,
  startNight,
  act,
  scoreNight,
  viewFor,
  prestige,
} from "../server/game.js";

function fixture(n = 4) {
  const ps = Array.from({ length: n }, (_, i) =>
      newPlayer("Player " + (i + 1)),
    ),
    g = createGame(ps, ps[0].id);
  ps.forEach((p, i) => {
    p.identity = {
      house: i % 2 ? "stormwing" : "ashthorn",
      rank: Math.floor(i / 2) + 1,
    };
    p.knownIdentity = { ...p.identity };
  });
  return g;
}
function setup(id, kind = "target", n = 4) {
  const g = fixture(n);
  g.stage = "night";
  g.phase = 2;
  g.prompt = {
    id: "prompt",
    playerId: g.players[0].id,
    kind,
    cardId: id,
    count: id === "usurper" ? 2 : 1,
  };
  return g;
}
function move(g, data, p = g.players[0]) {
  act(g, p.id, { promptId: g.prompt?.id, ...data });
}
function tokens(p, values) {
  p.tokens = values.map((value, i) => ({ id: p.id + "-" + i, value }));
}

test("33 cards, unique IDs, six cards in each numbered category", () => {
  assert.equal(CARDS.length, 33);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, 33);
  for (const type of [
    "Informant",
    "Oracle",
    "Conspirator",
    "Cutthroat",
    "King’s Blade",
  ])
    assert.deepEqual(
      CARDS.filter((c) => c.type === type).map((c) => c.order),
      [1, 2, 3, 4, 5, 6],
    );
});
test("draft passes two left and preserves exactly two cards per seat", () => {
  const g = fixture();
  startNight(g);
  const original = g.players.map((p) => [...p.draft]);
  for (const p of g.players) move(g, { type: "draft", cardId: p.draft[0] }, p);
  assert.equal(g.stage, "draft2");
  for (let i = 0; i < 4; i++)
    assert.deepEqual(g.players[i].draft, original[(i + 3) % 4].slice(1));
  const kept = g.players.map((p) => [...p.kept, p.draft[0]]);
  for (const p of g.players) move(g, { type: "draft", cardId: p.draft[0] }, p);
  assert.equal(g.discard.length, 4);
  for (let i = 0; i < 4; i++)
    assert.deepEqual(
      [...g.players[i].hand, ...g.players[i].played].sort(),
      kept[i].sort(),
    );
});
test("odd seating adds exactly one Unsworn", () => {
  for (const n of [5, 7, 9]) {
    const g = fixture(n);
    startNight(g);
    assert.equal(
      g.players.filter((p) => p.identity.house === "unsworn").length,
      1,
    );
  }
});
test("private projections exclude other hands, values, secrets and draft cards", () => {
  const g = fixture();
  startNight(g);
  tokens(g.players[1], [4, 3]);
  const v = viewFor(g, g.players[0].id),
    other = v.players[1];
  assert.equal(other.sealCount, 2);
  for (const k of ["hand", "tokens", "secret", "knowledge", "draft"])
    assert.equal(other[k], undefined);
  assert.equal(other.identity, null);
  assert.ok(!JSON.stringify(v).includes(g.players[1].secret));
  assert.equal(viewFor(g, "spectator").me, null);
});
test("wrong seat and stale prompt cannot act", () => {
  const g = setup("informant-1");
  assert.throws(
    () => move(g, { targets: [g.players[2].id] }, g.players[1]),
    /Wait/,
  );
  assert.throws(
    () =>
      act(g, g.players[0].id, { promptId: "old", targets: [g.players[1].id] }),
    /Wait/,
  );
});
test("Informant privately inspects allegiance and rank", () => {
  const g = setup("informant-1");
  move(g, { targets: [g.players[1].id] });
  assert.equal(g.prompt.kind, "inspect");
  assert.deepEqual(g.prompt.info[0].identity, g.players[1].identity);
  assert.equal(viewFor(g, g.players[1].id).prompt, null);
});
test("Oracle inspects one unplayed card, never played cards", () => {
  const g = setup("oracle-1");
  g.players[1].hand = ["mirror"];
  g.players[1].played = ["blade-1"];
  move(g, { targets: [g.players[1].id] });
  assert.equal(g.prompt.glimpse.id, "mirror");
});
test("Usurper exchange hides new identities from their owners", () => {
  const g = setup("usurper");
  const [a, b] = g.players;
  g.queue = [{ playerId: g.players[2].id, cardId: "herald" }];
  move(g, { targets: [a.id, b.id] });
  move(g, { choice: "swap" });
  assert.equal(a.identity.house, "stormwing");
  assert.equal(a.knownIdentity, null);
  assert.equal(b.knownIdentity, null);
  assert.equal(b.publicIdentity, false);
  assert.equal(viewFor(g, b.id).me.identity, null);
  assert.equal(viewFor(g, g.players[3].id).players[0].identity, null);
});
test("Herald can reveal a living or fallen identity", () => {
  const g = setup("herald");
  g.players[1].alive = false;
  move(g, { targets: [g.players[1].id] });
  move(g, { choice: "reveal" });
  assert.equal(g.players[1].publicIdentity, true);
});
test("Justiciar bypasses Mirror Warden and Martyr", () => {
  const g = setup("justiciar");
  g.players[1].hand = ["mirror", "martyr"];
  move(g, { targets: [g.players[1].id] });
  assert.equal(g.players[1].alive, false);
  assert.ok(!g.players[1].played.includes("mirror"));
});
test("Mirror Warden kills attacker and survives", () => {
  const g = setup("cutthroat-1");
  g.players[1].hand = ["mirror"];
  move(g, { targets: [g.players[1].id] });
  assert.equal(g.prompt.kind, "react");
  move(g, { choice: "mirror" }, g.players[1]);
  assert.equal(g.players[0].alive, false);
  assert.equal(g.players[1].alive, true);
});
test("Martyr earns a seal but dies; no immediate coronation", () => {
  const g = setup("blade-1");
  g.players[1].hand = ["martyr"];
  tokens(g.players[1], [4, 4]);
  move(g, { targets: [g.players[1].id] });
  move(g, { choice: "kill" });
  move(g, { choice: "martyr" }, g.players[1]);
  assert.equal(g.players[1].alive, false);
  assert.ok(g.players[1].tokens.length >= 3);
});
test("no reaction causes no decision window", () => {
  const g = setup("cutthroat-1");
  move(g, { targets: [g.players[1].id] });
  assert.equal(g.players[1].alive, false);
  assert.notEqual(g.prompt?.kind, "react");
});
test("King’s Blade may spare a privately inspected target", () => {
  const g = setup("blade-1");
  move(g, { targets: [g.players[1].id] });
  assert.equal(g.players[1].alive, true);
  move(g, { choice: "spare" });
  assert.equal(g.players[1].alive, true);
});
test("King’s Blade can inspect its own exchanged identity", () => {
  const g = setup("blade-1");
  g.players[0].knownIdentity = null;
  move(g, { targets: [g.players[0].id] });
  assert.deepEqual(g.prompt.info[0].identity, g.players[0].identity);
  move(g, { choice: "spare" });
  assert.equal(g.players[0].alive, true);
});
test("Crown Thief can steal from fallen players and retains token value", () => {
  const g = setup("thief");
  g.players[1].alive = false;
  tokens(g.players[1], [4, 3]);
  const seal = g.players[1].tokens[0];
  move(g, { targets: [g.players[1].id] });
  move(g, { tokenId: seal.id });
  assert.ok(g.players[0].tokens.some((t) => t.id === seal.id && t.value === 4));
  assert.equal(g.players[1].tokens.length, 1);
});
test("Soul Broker exchanges exact tokens without changing values", () => {
  const g = setup("broker");
  tokens(g.players[0], [2]);
  tokens(g.players[1], [4]);
  const mine = g.players[0].tokens[0],
    theirs = g.players[1].tokens[0];
  move(g, { targets: [g.players[1].id] });
  move(g, { tokenId: theirs.id });
  assert.equal(g.prompt.token.value, 4);
  move(g, { choice: "swap", mine: mine.id, theirs: theirs.id });
  assert.ok(
    g.players[0].tokens.some((t) => t.id === theirs.id && t.value === 4),
  );
  assert.ok(g.players[1].tokens.some((t) => t.id === mine.id && t.value === 2));
});
test("Cryptkeeper inspects only sampled discard and supports immediate play", () => {
  const g = setup("cryptkeeper", "recover");
  g.discard = ["informant-1", "mirror", "blade-1"];
  g.prompt.options = ["informant-1", "mirror"];
  move(g, { cardId: "informant-1" });
  assert.equal(g.prompt.kind, "recovered");
  move(g, { choice: "now" });
  assert.equal(g.prompt.cardId, "informant-1");
  assert.equal(g.prompt.kind, "target");
  assert.ok(!g.discard.includes("informant-1"));
  assert.ok(g.discard.includes("mirror"));
});
test("Cryptkeeper saves a recovered reaction for its trigger", () => {
  const g = setup("cryptkeeper", "recover");
  g.discard = ["mirror", "blade-1"];
  g.prompt.options = [...g.discard];
  move(g, { cardId: "mirror" });
  assert.throws(() => move(g, { choice: "now" }), /special timing/);
  move(g, { choice: "save" });
  assert.ok(g.players[0].hand.includes("mirror"));
});
test("best surviving bloodline rewards eliminated allies", () => {
  const g = fixture();
  g.players[1].alive = false;
  g.players[2].alive = false;
  scoreNight(g);
  assert.equal(g.result.winningHouse, "ashthorn");
  assert.equal(g.players[2].tokens.length, 1);
});
test("second rank breaks a first-rank tie", () => {
  const g = fixture(6);
  g.players[3].alive = false;
  scoreNight(g);
  assert.equal(g.result.winningHouse, "ashthorn");
  assert.match(g.result.reason, /comparison 2/);
});
test("complete bloodline ties award all survivors", () => {
  const g = fixture();
  scoreNight(g);
  assert.equal(g.result.tie, true);
  assert.equal(g.result.awards.length, 4);
});
test("surviving Unsworn earns one seal, fallen Unsworn none", () => {
  for (const alive of [true, false]) {
    const g = fixture(5);
    g.players[4].identity = { house: "unsworn", rank: null };
    g.players[4].alive = alive;
    g.players[1].alive = false;
    scoreNight(g);
    assert.equal(g.players[4].tokens.length, alive ? 1 : 0);
  }
});
test("living Kingmaker overrides ranks; Unsworn Kingmaker denies both houses", () => {
  for (const house of ["stormwing", "unsworn"]) {
    const g = fixture();
    g.players[2].identity = { house, rank: 5 };
    g.players[2].hand = ["kingmaker"];
    scoreNight(g);
    assert.equal(
      g.result.winningHouse,
      house === "unsworn" ? null : "stormwing",
    );
    if (house === "unsworn")
      assert.deepEqual(g.result.awards, [g.players[2].id]);
  }
});
test("equal highest totals of 10+ crown joint heirs", () => {
  const g = fixture();
  g.players.forEach((p) => (p.alive = false));
  tokens(g.players[0], [4, 4, 2]);
  tokens(g.players[1], [3, 3, 4]);
  tokens(g.players[2], [4, 4]);
  scoreNight(g);
  assert.equal(g.stage, "victory");
  assert.deepEqual(g.winners, [g.players[0].id, g.players[1].id]);
});
test("invalid card and target requests do not change state", () => {
  const g = setup("usurper");
  const before = JSON.stringify(g);
  assert.throws(() => move(g, { targets: [g.players[0].id, g.players[0].id] }));
  assert.equal(JSON.stringify(g), before);
});
test("fresh night keeps seals but resets identities/hands/knowledge", () => {
  const g = fixture();
  tokens(g.players[0], [3]);
  g.stage = "dawn";
  startNight(g);
  assert.equal(prestige(g.players[0]), 3);
  assert.equal(g.players[0].knowledge.length, 0);
  assert.equal(g.players[0].draft.length, 3);
});

export function autoAction(g) {
  if (g.stage.startsWith("draft")) {
    for (const p of g.players)
      if (!p.selected) move(g, { type: "draft", cardId: p.draft[0] }, p);
    return;
  }
  const q = g.prompt,
    p = g.players.find((p) => p.id === q?.playerId);
  assert.ok(q, "live night must always have a prompt");
  if (q.kind === "target") {
    const c = CARD_MAP[q.cardId];
    let targets = g.players.filter(
      (t) =>
        (["usurper", "justiciar"].includes(q.cardId) ||
          ["Cutthroat", "King’s Blade"].includes(c.type) ||
          t.id !== p.id) &&
        (!(
          c.type === "Cutthroat" ||
          c.type === "King’s Blade" ||
          q.cardId === "justiciar"
        ) ||
          t.alive) &&
        (q.cardId !== "thief" || t.tokens.length > p.tokens.length),
    );
    move(g, { targets: targets.slice(0, q.count).map((t) => t.id) }, p);
  } else if (q.kind === "inspect")
    move(
      g,
      {
        choice:
          q.cardId === "usurper"
            ? "swap"
            : q.cardId === "herald"
              ? "reveal"
              : CARD_MAP[q.cardId].type === "King’s Blade"
                ? "kill"
                : "done",
      },
      p,
    );
  else if (q.kind === "recover") move(g, { cardId: q.options[0] }, p);
  else if (q.kind === "recovered")
    move(g, { choice: categoryIndex(q.cardId) < 0 ? "save" : "now" }, p);
  else if (q.kind === "react") move(g, { choice: q.options[0] }, p);
  else if (q.kind === "steal") move(g, { tokenId: q.options[0] }, p);
  else if (q.kind === "brokerInspect") move(g, { choice: "identity" }, p);
  else if (q.kind === "exchange") move(g, { choice: "done" }, p);
  else assert.fail(q.kind);
}
test("100 complete randomized matches, 4–10 seats, always terminate with valid private views", () => {
  for (let match = 0; match < 100; match++) {
    const g = fixture(4 + (match % 7));
    let nights = 0,
      steps = 0;
    while (g.stage !== "victory" && nights < 60) {
      startNight(g);
      nights++;
      while (["draft1", "draft2", "night"].includes(g.stage)) {
        autoAction(g);
        assert.ok(++steps < 10000);
        for (const p of g.players) {
          const v = viewFor(g, p.id);
          assert.equal(v.me.prestige, prestige(p));
          assert.ok(
            v.players.every((t) => !("secret" in t) && !("tokens" in t)),
          );
        }
      }
    }
    assert.equal(g.stage, "victory", `match ${match} must finish`);
  }
});
