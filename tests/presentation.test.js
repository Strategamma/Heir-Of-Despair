import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  newPlayer,
  startNight,
  act,
  advancePresentation,
  viewFor,
  scoreNight,
} from "../server/game.js";
function court() {
  const ps = Array.from({ length: 4 }, (_, i) => newPlayer(`Seat ${i + 1}`));
  const g = createGame(ps, ps[0].id);
  g.paced = true;
  startNight(g);
  ps.forEach(
    (p, i) =>
      (p.draft = [
        `informant-${i + 1}`,
        `blade-${i + 1}`,
        `cutthroat-${i + 1}`,
      ]),
  );
  for (const p of ps) act(g, p.id, { type: "draft", cardId: p.draft[0] });
  for (const p of ps) act(g, p.id, { type: "draft", cardId: p.draft[0] });
  return g;
}
test("phase reveal waits, then exposes only the public active card to every seat", () => {
  const g = court();
  assert.equal(g.presentation.kind, "phase");
  assert.equal(g.prompt, null);
  assert.equal(advancePresentation(g, g.presentation.until - 1), false);
  assert.equal(advancePresentation(g, g.presentation.until), true);
  assert.equal(g.prompt.cardId, "informant-1");
  for (const p of g.players)
    assert.deepEqual(viewFor(g, p.id).activeCard, {
      playerId: g.players[0].id,
      cardId: "informant-1",
    });
  const actor = g.players[0],
    other = g.players[1];
  act(g, actor.id, {
    type: "target",
    promptId: g.prompt.id,
    targets: [other.id],
  });
  assert.equal(viewFor(g, other.id).prompt, null);
  act(g, actor.id, { type: "choice", promptId: g.prompt.id, choice: "done" });
  assert.equal(g.presentation.kind, "resolution");
  assert.equal(g.prompt, null);
  assert.equal(advancePresentation(g, g.presentation.until - 1), false);
  advancePresentation(g, g.presentation.until);
  assert.equal(g.prompt.cardId, "informant-2");
});
test("host pause freezes presentation and each empty category is still announced", () => {
  const g = court();
  g.paused = true;
  assert.equal(advancePresentation(g, Infinity), false);
  g.paused = false;
  g.queue = [];
  advancePresentation(g, Infinity);
  assert.equal(g.phase, 1);
  assert.equal(g.presentation.kind, "phase");
  assert.ok(g.log.includes("Calling all Oracles."));
  advancePresentation(g, Infinity);
  assert.equal(g.phase, 2);
  assert.ok(g.log.includes("Calling all Conspirators."));
});

test("final totals are public only at coronation; individual seal values stay private", () => {
  const g = court();
  g.players.forEach(
    (p, i) =>
      (p.tokens = [
        { id: `t-${i}`, value: (i % 3) + 2 },
        { id: `s-${i}`, value: 3 },
      ]),
  );
  for (const stage of ["draft1", "draft2", "night", "dawn"]) {
    g.stage = stage;
    for (const viewer of g.players)
      for (const p of viewFor(g, viewer.id).players) {
        assert.equal(p.prestige, undefined);
        assert.equal(p.tokens, undefined);
      }
  }
  g.stage = "victory";
  for (const viewer of g.players)
    viewFor(g, viewer.id).players.forEach((p, i) => {
      assert.equal(p.prestige, (i % 3) + 5);
      assert.equal(p.sealCount, 2);
      assert.equal(p.tokens, undefined);
    });
});

test("phase call reveals every matching owner as waiting, then playing and played; future cards stay hidden", () => {
  const g = court();
  for (const viewer of g.players) {
    const v = viewFor(g, viewer.id);
    assert.equal(v.players.flatMap((p) => p.played).length, 4);
    v.players.forEach((p, i) => {
      assert.equal(p.played[0].id, `informant-${i + 1}`);
      assert.equal(p.played[0].status, "waiting");
    });
    assert.ok(
      !v.players
        .flatMap((p) => p.played)
        .some((c) => c.type === "King’s Blade"),
    );
  }
  advancePresentation(g, Infinity);
  assert.equal(
    viewFor(g, g.players[1].id).players[0].played[0].status,
    "playing",
  );
  act(g, g.players[0].id, {
    type: "target",
    promptId: g.prompt.id,
    targets: [g.players[1].id],
  });
  act(g, g.players[0].id, {
    type: "choice",
    promptId: g.prompt.id,
    choice: "done",
  });
  assert.equal(
    viewFor(g, g.players[1].id).players[0].played[0].status,
    "played",
  );
  g.players[1].alive = false;
  assert.equal(
    viewFor(g, g.players[0].id).players[1].played[0].status,
    "skipped",
  );
  advancePresentation(g, Infinity);
  assert.equal(g.activeCard.playerId, g.players[2].id);
  assert.equal(
    viewFor(g, g.players[0].id).players[1].played[0].status,
    "skipped",
  );
});

test("Kingmaker overrides succession for either current house and rewards fallen allies", () => {
  for (const house of ["ashthorn", "stormwing"]) {
    const ps = Array.from({ length: 4 }, (_, i) => newPlayer(`Seat ${i + 1}`)),
      g = createGame(ps, ps[0].id);
    const rival = house === "ashthorn" ? "stormwing" : "ashthorn";
    ps.forEach(
      (p, i) =>
        (p.identity = { house: i % 2 ? house : rival, rank: i < 2 ? 1 : 2 }),
    );
    ps[1].alive = false;
    ps[3].hand = ["kingmaker"];
    g.stage = "night";
    scoreNight(g);
    assert.equal(g.result.kingmaker, ps[3].id);
    assert.equal(g.result.winningHouse, house);
    assert.deepEqual(g.result.awards, [ps[1].id, ps[3].id]);
    assert.deepEqual(
      ps.map((p) => p.tokens.length),
      [0, 1, 0, 1],
    );
  }
});
