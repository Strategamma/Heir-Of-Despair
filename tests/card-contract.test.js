import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, CARD_MAP } from "../shared/cards.js";
import {
  newPlayer,
  createGame,
  act,
  viewFor,
  scoreNight,
} from "../server/game.js";

// Keep a harmless next action pending: dawn awards must not count as card effects.
function table(id) {
  const ps = ["Actor", "Target", "Other", "Next"].map(newPlayer);
  const g = createGame(ps, ps[0].id);
  Object.assign(g, { stage: "night", night: 1, phase: 2 });
  ps.forEach((p, i) => {
    p.identity = {
      house: i % 2 ? "stormwing" : "ashthorn",
      rank: 1 + Math.floor(i / 2),
    };
    p.knownIdentity = { ...p.identity };
    p.tokens = [{ id: `seal-${i}`, value: i % 2 ? 4 : 2 }];
  });
  ps[0].played = [id];
  ps[1].hand = ["blade-2", "kingmaker"].filter((c) => c !== id);
  ps[3].played = ["informant-6"];
  g.queue = [
    { playerId: ps[0].id, cardId: id },
    { playerId: ps[3].id, cardId: "informant-6" },
  ];
  g.prompt = {
    id: "previous",
    playerId: ps[3].id,
    cardId: "informant-1",
    kind: "inspect",
    info: [],
  };
  return g;
}
function move(g, data, p = g.players[0]) {
  act(g, p.id, { promptId: g.prompt.id, ...data });
}
function begin(g) {
  move(g, { choice: "done" }, g.players[3]);
}
function domain(g) {
  return structuredClone(
    g.players.map((p) => ({
      identity: p.identity,
      knownIdentity: p.knownIdentity,
      publicIdentity: p.publicIdentity,
      alive: p.alive,
      tokens: p.tokens,
      hand: p.hand,
      played: p.played,
      knowledge: p.knowledge,
    })),
  );
}
function only(g, before, allowed = {}) {
  const after = domain(g);
  for (let i = 0; i < before.length; i++) {
    for (const key of Object.keys(before[i])) {
      if (!(allowed[i] ?? []).includes(key)) {
        assert.deepEqual(
          after[i][key],
          before[i][key],
          `Unexpected change to player ${i} ${key}`,
        );
      }
    }
  }
}
function held(g) {
  assert.equal(
    g.stage,
    "night",
    "Card resolution must remain separate from dawn",
  );
  assert.equal(g.prompt.playerId, g.players[3].id);
}

for (const c of CARDS.filter((c) => ["Informant", "Oracle"].includes(c.type))) {
  test(`${c.id}: only private identity inspection${c.type === "Oracle" ? " plus one hand card" : ""}`, () => {
    const g = table(c.id),
      [p, t] = g.players,
      before = domain(g);
    begin(g);
    move(g, { targets: [t.id] });
    assert.deepEqual(g.prompt.info, [
      { playerId: t.id, name: t.name, identity: t.identity },
    ]);
    if (c.type === "Oracle") assert.ok(t.hand.includes(g.prompt.glimpse.id));
    else assert.equal(g.prompt.glimpse, null);
    assert.equal(viewFor(g, t.id).prompt, null);
    assert.equal(viewFor(g, t.id).players[0].identity, null);
    assert.equal(p.knowledge.length, 1);
    assert.throws(() => move(g, { choice: "kill" }));
    move(g, { choice: "done" });
    held(g);
    only(g, before, { 0: ["knowledge"] });
  });
}
test("Oracle with no hand card still inspects only the identity", () => {
  const g = table("oracle-1");
  g.players[1].hand = [];
  const before = domain(g);
  begin(g);
  move(g, { targets: [g.players[1].id] });
  assert.equal(g.prompt.glimpse, null);
  move(g, { choice: "done" });
  held(g);
  only(g, before, { 0: ["knowledge"] });
});

for (const c of CARDS.filter((c) => c.type === "Cutthroat")) {
  test(`${c.id}: only the selected courtier dies, with no inspection/reveal/reward`, () => {
    const g = table(c.id),
      before = domain(g);
    begin(g);
    move(g, { targets: [g.players[1].id] });
    assert.equal(g.players[1].alive, false);
    held(g);
    only(g, before, { 1: ["alive"] });
  });
}
for (const c of CARDS.filter((c) => c.type === "King’s Blade")) {
  for (const choice of ["spare", "kill"]) {
    test(`${c.id}/${choice}: identity inspection then exactly the chosen outcome`, () => {
      const g = table(c.id),
        before = domain(g);
      begin(g);
      move(g, { targets: [g.players[1].id] });
      assert.equal(g.players[1].alive, true);
      assert.deepEqual(g.prompt.info[0].identity, g.players[1].identity);
      assert.equal(g.prompt.glimpse, null);
      move(g, { choice });
      assert.equal(g.players[1].alive, choice === "spare");
      held(g);
      only(g, before, {
        0: ["knowledge"],
        ...(choice === "kill" ? { 1: ["alive"] } : {}),
      });
    });
  }
}

for (const choice of ["swap", "done"]) {
  test(`Usurper/${choice}: exactly two identities inspected, both locked, no other changes`, () => {
    const g = table("usurper"),
      before = domain(g);
    begin(g);
    move(g, { targets: [g.players[1].id, g.players[2].id] });
    assert.equal(g.prompt.info.length, 2);
    assert.equal(viewFor(g, g.players[1].id).prompt, null);
    move(g, { choice });
    for (const i of [1, 2]) {
      assert.equal(g.players[i].knownIdentity, null);
      assert.equal(g.players[i].publicIdentity, false);
      assert.deepEqual(
        g.players[i].identity,
        before[choice === "swap" ? 3 - i : i].identity,
      );
    }
    held(g);
    only(g, before, {
      0: ["knowledge"],
      1: ["identity", "knownIdentity"],
      2: ["identity", "knownIdentity"],
    });
  });
}
test("Usurper swap and keep have identical public and affected-owner projections", () => {
  const g = table("usurper");
  begin(g);
  move(g, { targets: [g.players[1].id, g.players[2].id] });
  const kept = structuredClone(g),
    swapped = structuredClone(g);
  move(kept, { choice: "done" });
  move(swapped, { choice: "swap" });
  for (const p of g.players.slice(1)) {
    const publicView = (game) => {
      const v = viewFor(game, p.id);
      delete v.prompt;
      return v;
    };
    assert.deepEqual(publicView(kept), publicView(swapped));
  }
});

for (const choice of ["done", "reveal"]) {
  test(`Herald/${choice}: one private inspection; public identity only if chosen`, () => {
    const g = table("herald"),
      before = domain(g);
    begin(g);
    move(g, { targets: [g.players[1].id] });
    assert.equal(g.players[1].publicIdentity, false);
    move(g, { choice });
    assert.equal(g.players[1].publicIdentity, choice === "reveal");
    held(g);
    only(g, before, {
      0: ["knowledge"],
      ...(choice === "reveal" ? { 1: ["publicIdentity"] } : {}),
    });
  });
}
for (const inspect of ["identity", "token"]) {
  for (const exchange of [false, true]) {
    test(`Soul Broker/${inspect}/${exchange ? "exchange" : "keep"}: inspection and optional one-for-one transfer only`, () => {
      const g = table("broker"),
        [p, t] = g.players,
        before = domain(g);
      begin(g);
      move(g, { targets: [t.id] });
      assert.equal(g.prompt.info, undefined);
      if (inspect === "identity") move(g, { choice: "identity" });
      else move(g, { tokenId: t.tokens[0].id });
      if (inspect === "identity") {
        assert.deepEqual(g.prompt.info.identity, t.identity);
        assert.equal(g.prompt.token, null);
      } else {
        assert.deepEqual(g.prompt.token, t.tokens[0]);
        assert.equal(g.prompt.info, null);
      }
      if (exchange)
        move(g, {
          choice: "swap",
          mine: p.tokens[0].id,
          theirs: t.tokens[0].id,
        });
      else move(g, { choice: "done" });
      assert.deepEqual(p.tokens, before[exchange ? 1 : 0].tokens);
      assert.deepEqual(t.tokens, before[exchange ? 0 : 1].tokens);
      held(g);
      only(g, before, {
        0: [
          ...(inspect === "identity" ? ["knowledge"] : []),
          ...(exchange ? ["tokens"] : []),
        ],
        ...(exchange ? { 1: ["tokens"] } : {}),
      });
    });
  }
}
for (const choice of ["skip", "take"]) {
  test(`Crown Thief/${choice}: reveal self, transfer at most one existing seal by seal count`, () => {
    const g = table("thief"),
      [p, t] = g.players;
    p.tokens = [{ id: "mine", value: 4 }];
    t.tokens = [
      { id: "theirs-a", value: 2 },
      { id: "theirs-b", value: 2 },
    ];
    const before = domain(g);
    begin(g);
    assert.equal(p.publicIdentity, true);
    move(g, { targets: [t.id] });
    assert.deepEqual(g.prompt.options, ["theirs-a", "theirs-b"]);
    assert.equal(g.prompt.info, undefined);
    move(g, choice === "skip" ? { choice: "skip" } : { tokenId: "theirs-b" });
    assert.deepEqual(
      p.tokens,
      choice === "skip"
        ? before[0].tokens
        : [...before[0].tokens, before[1].tokens[1]],
    );
    assert.deepEqual(
      t.tokens,
      choice === "skip" ? before[1].tokens : [before[1].tokens[0]],
    );
    held(g);
    only(g, before, {
      0: ["publicIdentity", ...(choice === "take" ? ["tokens"] : [])],
      ...(choice === "take" ? { 1: ["tokens"] } : {}),
    });
  });
}
test("Crown Thief with no richer seal holder only reveals self", () => {
  const g = table("thief"),
    before = domain(g);
  begin(g);
  held(g);
  only(g, before, { 0: ["publicIdentity"] });
});
test("High Justiciar only reveals self and kills target; neither reaction may trigger", () => {
  const g = table("justiciar");
  g.players[1].hand = ["mirror", "martyr"];
  const before = domain(g);
  begin(g);
  move(g, { targets: [g.players[1].id] });
  assert.equal(g.players[0].publicIdentity, true);
  assert.equal(g.players[1].alive, false);
  held(g);
  only(g, before, { 0: ["publicIdentity"], 1: ["alive"] });
});

test("Cryptkeeper only exposes two sampled draft discards and removes the selected one", () => {
  const g = table("cryptkeeper");
  g.discard = ["informant-4", "oracle-3", "blade-5"];
  const before = domain(g);
  begin(g);
  assert.equal(g.prompt.kind, "recover");
  assert.equal(g.prompt.options.length, 2);
  assert.ok(g.prompt.options.every((id) => g.discard.includes(id)));
  assert.equal(viewFor(g, g.players[1].id).prompt, null);
  const offered = [...g.prompt.options],
    unoffered = g.discard.find((id) => !offered.includes(id));
  const beforeInvalid = structuredClone(g);
  assert.throws(() => move(g, { cardId: unoffered }));
  assert.deepEqual(g, beforeInvalid);
  move(g, { cardId: offered[0] });
  assert.deepEqual(g.discard.sort(), [offered[1], unoffered].sort());
  assert.deepEqual(g.players[0].hand, [...before[0].hand, offered[0]]);
  assert.equal(g.prompt.kind, "recovered");
  only(g, before, { 0: ["hand"] });
});
test("Cryptkeeper save retains a future card without firing its power", () => {
  const g = table("cryptkeeper");
  g.discard = ["blade-5", "martyr"];
  const before = domain(g);
  begin(g);
  move(g, { cardId: "blade-5" });
  move(g, { choice: "save" });
  held(g);
  assert.deepEqual(g.players[0].hand, [...before[0].hand, "blade-5"]);
  only(g, before, { 0: ["hand"] });
});
test("Cryptkeeper immediate recovery invokes only that recovered card's power", () => {
  const g = table("cryptkeeper");
  g.discard = ["informant-4", "martyr"];
  const before = domain(g);
  begin(g);
  move(g, { cardId: "informant-4" });
  move(g, { choice: "now" });
  assert.equal(g.prompt.kind, "target");
  assert.equal(g.prompt.cardId, "informant-4");
  move(g, { targets: [g.players[1].id] });
  move(g, { choice: "done" });
  held(g);
  only(g, before, { 0: ["played", "knowledge"] });
});

for (const id of ["cutthroat-1", "blade-1"]) {
  for (const reaction of ["mirror", "martyr", "skip"]) {
    test(`${id}/${reaction}: a single triggered response, no unrelated effects`, () => {
      const g = table(id),
        [p, t] = g.players;
      t.hand = ["mirror", "martyr"];
      p.hand = [];
      const before = domain(g);
      begin(g);
      move(g, { targets: [t.id] });
      if (id === "blade-1") {
        assert.equal(g.prompt.kind, "inspect");
        move(g, { choice: "kill" });
      }
      assert.equal(g.prompt.kind, "react");
      assert.equal(g.prompt.playerId, t.id);
      move(g, { choice: reaction }, t);
      assert.equal(p.alive, reaction !== "mirror");
      assert.equal(t.alive, reaction === "mirror");
      assert.equal(
        t.tokens.length,
        before[1].tokens.length + (reaction === "martyr" ? 1 : 0),
      );
      if (reaction === "martyr") {
        assert.ok([2, 3, 4].includes(t.tokens.at(-1).value));
        assert.deepEqual(t.tokens.slice(0, -1), before[1].tokens);
      }
      assert.deepEqual(
        t.hand,
        reaction === "skip"
          ? before[1].hand
          : before[1].hand.filter((c) => c !== reaction),
      );
      held(g);
      only(g, before, {
        0: [
          ...(id === "blade-1" ? ["knowledge"] : []),
          ...(reaction === "mirror" ? ["alive"] : []),
        ],
        1: [
          "alive",
          ...(reaction !== "skip" ? ["hand", "played"] : []),
          ...(reaction === "martyr" ? ["tokens"] : []),
        ],
      });
    });
  }
}
test("King’s Blade inspection and spare do not trigger or expose reactions", () => {
  const g = table("blade-1");
  g.players[1].hand = ["mirror", "martyr"];
  const before = domain(g);
  begin(g);
  move(g, { targets: [g.players[1].id] });
  move(g, { choice: "spare" });
  held(g);
  only(g, before, { 0: ["knowledge"] });
});

for (const scenario of ["alive", "fallen", "unsworn"]) {
  test(`Kingmaker/${scenario}: only the appropriate dawn outcome and normal reward rule`, () => {
    const g = table("kingmaker"),
      [p, t, a, b] = g.players;
    p.identity = {
      house: scenario === "unsworn" ? "unsworn" : "ashthorn",
      rank: scenario === "unsworn" ? null : 5,
    };
    a.identity = { house: "ashthorn", rank: 4 };
    t.identity = { house: "stormwing", rank: 1 };
    b.identity = { house: "stormwing", rank: 2 };
    p.hand = ["kingmaker"];
    p.played = [];
    p.alive = scenario !== "fallen";
    const before = domain(g);
    scoreNight(g);
    const expected =
      scenario === "unsworn"
        ? [p.id]
        : scenario === "fallen"
          ? [t.id, b.id]
          : [p.id, a.id];
    assert.deepEqual(g.result.awards, expected);
    assert.equal(
      g.result.winningHouse,
      scenario === "unsworn"
        ? null
        : scenario === "fallen"
          ? "stormwing"
          : "ashthorn",
    );
    g.players.forEach((x, i) => {
      assert.equal(
        x.tokens.length,
        before[i].tokens.length + Number(expected.includes(x.id)),
      );
      assert.deepEqual(
        x.tokens.slice(0, before[i].tokens.length),
        before[i].tokens,
      );
      assert.deepEqual(x.identity, before[i].identity);
      assert.equal(x.alive, before[i].alive);
      assert.deepEqual(x.knowledge, before[i].knowledge);
    });
  });
}
