import { randomInt, randomUUID } from "node:crypto";
import {
  CARDS,
  CARD_MAP,
  PHASES,
  HOUSES,
  categoryIndex,
} from "../shared/cards.js";

export function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const fail = (message) => {
  throw new Error(message);
};
const requireRule = (ok, message) => {
  if (!ok) fail(message);
};
export const prestige = (p) => p.tokens.reduce((s, t) => s + t.value, 0);
export function newPlayer(name) {
  return {
    id: randomUUID(),
    name,
    secret: randomUUID(),
    online: true,
    tokens: [],
    hand: [],
    played: [],
    alive: true,
    identity: null,
    knownIdentity: null,
    publicIdentity: false,
    knowledge: [],
    draft: [],
    kept: [],
  };
}
export function createGame(players, hostId) {
  return {
    players,
    hostId,
    stage: "lobby",
    night: 0,
    phase: -1,
    cardStates: {},
    queue: [],
    prompt: null,
    discard: [],
    log: [],
    revision: 0,
    paused: false,
    votes: [],
    result: null,
    winners: [],
  };
}
function log(g, text) {
  g.log.push(text);
  if (g.log.length > 40) g.log.shift();
}
function prompt(g, p, kind, data = {}) {
  g.prompt = { id: randomUUID(), playerId: p.id, kind, ...data };
}
function player(g, id) {
  return g.players.find((p) => p.id === id);
}
function inspect(p, target) {
  const info = {
    playerId: target.id,
    name: target.name,
    identity: { ...target.identity },
  };
  p.knowledge.push(info);
  return info;
}
function seal(p) {
  p.tokens.push({ id: randomUUID(), value: randomInt(2, 5) });
}
export function startNight(g) {
  requireRule(
    ["lobby", "dawn"].includes(g.stage),
    "A new night cannot begin yet.",
  );
  const remaining = g.players.filter((p) => !p.departed);
  requireRule(
    remaining.length >= 4 && remaining.length <= 10,
    "Gather 4–10 players.",
  );
  requireRule(
    remaining.every((p) => p.online),
    "Wait for all seated players to reconnect.",
  );
  g.players = remaining;
  const ids = [];
  for (let rank = 1; rank <= Math.floor(g.players.length / 2); rank++)
    for (const house of ["ashthorn", "stormwing"]) ids.push({ house, rank });
  if (g.players.length % 2) ids.push({ house: "unsworn", rank: null });
  const identities = shuffle(ids),
    deck = shuffle(CARDS.map((c) => c.id));
  g.players.forEach((p, i) =>
    Object.assign(p, {
      alive: true,
      identity: identities[i],
      knownIdentity: { ...identities[i] },
      publicIdentity: false,
      hand: [],
      played: [],
      knowledge: [],
      draft: deck.splice(0, 3),
      kept: [],
      selected: false,
    }),
  );
  Object.assign(g, {
    stage: "draft1",
    night: g.night + 1,
    phase: -1,
    cardStates: {},
    queue: [],
    prompt: null,
    discard: [],
    presentation: null,
    activeCard: null,
    result: null,
    winners: [],
    log: [],
    paused: false,
    votes: [],
  });
  log(
    g,
    `Night ${g.night}. The palace is sealed. Choose a card; pass two to your left.`,
  );
}
function draft(g, p, id) {
  requireRule(
    !p.selected && p.draft.includes(id),
    "Choose one of your available cards.",
  );
  p.kept.push(id);
  p.draft = p.draft.filter((c) => c !== id);
  p.selected = true;
  if (!g.players.every((p) => p.selected)) return;
  if (g.stage === "draft1") {
    const hands = g.players.map((p) => p.draft);
    g.players.forEach((p, i) => {
      p.draft = hands[(i - 1 + hands.length) % hands.length];
      p.selected = false;
    });
    g.stage = "draft2";
    log(g, "The letters pass left. Keep one card; discard the other.");
    completeDepartedDraft(g);
  } else {
    g.players.forEach((p) => {
      g.discard.push(...p.draft);
      p.hand = [...p.kept];
      p.draft = [];
      p.kept = [];
      p.selected = false;
    });
    g.stage = "night";
    advancePhase(g);
  }
}
// Preserve this night's pass direction, even when a seat is forfeited mid-draft.
function completeDepartedDraft(g) {
  for (const p of g.players) {
    if (!g.stage.startsWith("draft")) break;
    if (p.departed && !p.selected) draft(g, p, p.draft[0]);
  }
}
export function departSeat(g, id) {
  const p = player(g, id);
  requireRule(["draft1", "draft2", "night", "dawn"].includes(g.stage), "This night cannot be continued.");
  requireRule(p && !p.online && !p.departed && p.id !== g.hostId, "Choose a disconnected seat.");
  requireRule(g.players.filter((t) => !t.departed && t.id !== id).length >= 4, "Fewer than four players would remain. Abandon the game instead.");
  p.departed = true;
  p.alive = false;
  log(g, `${p.name} is marked fallen and will leave the court after this night.`);
  if (g.stage.startsWith("draft")) completeDepartedDraft(g);
  else if (g.stage === "night" && g.prompt?.playerId === id) {
    const q = g.prompt;
    // Inspection already happened; apply the normal keep decision, including locks.
    if (q.kind === "inspect" && q.cardId === "usurper") {
      act(g, id, { promptId: q.id, choice: "done" });
    } else nextAction(g);
  }
}
export function abandonGame(g) {
  requireRule(["draft1", "draft2", "night", "dawn"].includes(g.stage), "There is no active game to abandon.");
  Object.assign(g, { stage: "abandoned", prompt: null, presentation: null, activeCard: null, queue: [], paused: false, votes: [] });
  log(g, "The host has abandoned the game. No further seals are awarded.");
}
function cardState(g, playerId, cardId, status) {
  g.cardStates ??= {};
  g.cardStates[`${playerId}:${cardId}`] = status;
}
function finishActive(g) {
  if (g.activeCard)
    cardState(g, g.activeCard.playerId, g.activeCard.cardId, "played");
}
function advancePhase(g) {
  g.phase++;
  if (g.phase >= PHASES.length) {
    scoreNight(g);
    return;
  }
  g.queue = [];
  for (const p of g.players)
    if (p.alive) {
      const ids = p.hand.filter((id) => categoryIndex(id) === g.phase);
      for (const id of ids) {
        p.hand = p.hand.filter((c) => c !== id);
        p.played.push(id);
        g.queue.push({ playerId: p.id, cardId: id });
        cardState(g, p.id, id, "waiting");
      }
    }
  g.queue.sort((a, b) => CARD_MAP[a.cardId].order - CARD_MAP[b.cardId].order);
  g.activeCard = null;
  log(
    g,
    `Calling all ${["Informants", "Oracles", "Conspirators", "Cutthroats", "King’s Blades"][g.phase]}.`,
  );
  if (g.queue.length) log(g, `${PHASES[g.phase]} cards are revealed.`);
  if (g.paced) {
    g.presentation = { kind: "phase", until: Date.now() + 2800 };
    return;
  }
  nextAction(g);
}
export function advancePresentation(g, now = Date.now()) {
  if (!g.presentation || g.paused || now < g.presentation.until) return false;
  g.presentation = null;
  nextAction(g, true);
  g.revision++;
  return true;
}
function nextAction(g, immediate = false) {
  finishActive(g);
  g.prompt = null;
  if (g.paced && !immediate) {
    g.presentation = { kind: "resolution", until: Date.now() + 2400 };
    return;
  }
  let action;
  while ((action = g.queue.shift())) {
    const p = player(g, action.playerId);
    if (!p.alive) {
      cardState(g, p.id, action.cardId, "skipped");
      continue;
    }
    beginCard(g, p, action.cardId);
    return;
  }
  advancePhase(g);
}
function beginCard(g, p, id) {
  const c = CARD_MAP[id];
  finishActive(g);
  cardState(g, p.id, id, "playing");
  g.activeCard = { playerId: p.id, cardId: id };
  log(g, `${p.name} plays ${c.title}${c.order ? ` ${c.order}` : ""}.`);
  if (id === "cryptkeeper") {
    const options = shuffle(g.discard).slice(0, 2);
    if (!options.length) {
      nextAction(g);
      return;
    }
    prompt(g, p, "recover", { cardId: id, options });
    return;
  }
  if (id === "thief" || id === "justiciar") p.publicIdentity = true;
  if (
    id === "thief" &&
    !g.players.some((t) => t.id !== p.id && t.tokens.length > p.tokens.length)
  ) {
    log(g, "No courtier holds more seals.");
    nextAction(g);
    return;
  }
  prompt(g, p, "target", { cardId: id, count: id === "usurper" ? 2 : 1 });
}
function kill(g, p) {
  p.alive = false;
  log(g, `${p.name} has fallen.`);
}
function attack(g, attacker, target, id) {
  if (id !== "justiciar") {
    const options = target.hand.filter((c) => ["mirror", "martyr"].includes(c));
    if (options.length) {
      prompt(g, target, "react", {
        cardId: id,
        attackerId: attacker.id,
        targetId: target.id,
        options,
      });
      return;
    }
  }
  kill(g, target);
  nextAction(g);
}
function validTarget(g, p, id, cardId) {
  const t = player(g, id);
  requireRule(t, "That courtier is not seated.");
  const selfAllowed =
    ["usurper", "justiciar"].includes(cardId) ||
    ["Cutthroat", "King’s Blade"].includes(CARD_MAP[cardId].type);
  requireRule(selfAllowed || t.id !== p.id, "Choose another courtier.");
  if (
    cardId === "justiciar" ||
    ["Cutthroat", "King’s Blade"].includes(CARD_MAP[cardId].type)
  )
    requireRule(t.alive, "Choose a living courtier.");
  if (cardId === "thief")
    requireRule(
      t.tokens.length > p.tokens.length,
      "They must hold more seals than you.",
    );
  return t;
}
export function act(g, playerId, action) {
  requireRule(!g.paused, "The court is paused for reconnection.");
  const p = player(g, playerId);
  requireRule(p, "Unknown seat.");
  if (action.type === "draft") {
    requireRule(["draft1", "draft2"].includes(g.stage), "The draft has ended.");
    draft(g, p, action.cardId);
    g.revision++;
    return;
  }
  const q = g.prompt;
  requireRule(
    g.stage === "night" && q && q.playerId === p.id && q.id === action.promptId,
    "Wait for your current action.",
  );
  const id = q.cardId,
    c = CARD_MAP[id];
  if (q.kind === "target") {
    requireRule(
      Array.isArray(action.targets) &&
        action.targets.length === q.count &&
        new Set(action.targets).size === q.count,
      "Choose the required distinct targets.",
    );
    const targets = action.targets.map((t) => validTarget(g, p, t, id)),
      t = targets[0];
    log(
      g,
      `${p.name} uses ${c.title} on ${targets.map((t) => t.name).join(" and ")}.`,
    );
    if (c.type === "Cutthroat" || id === "justiciar") attack(g, p, t, id);
    else if (id === "thief") {
      prompt(g, p, "steal", {
        cardId: id,
        targetId: t.id,
        options: t.tokens.map((x) => x.id),
      });
    } else if (id === "broker")
      prompt(g, p, "brokerInspect", {
        cardId: id,
        targetId: t.id,
        tokenIds: t.tokens.map((x) => x.id),
      });
    else {
      const info = targets.map((t) => inspect(p, t));
      let glimpse = null;
      if (c.type === "Oracle" && t.hand.length)
        glimpse = CARD_MAP[shuffle(t.hand)[0]];
      prompt(g, p, "inspect", {
        cardId: id,
        targets: targets.map((t) => t.id),
        info,
        glimpse,
      });
    }
  } else if (q.kind === "inspect") {
    requireRule(
      ["done", "swap", "reveal", "kill", "spare"].includes(action.choice),
      "Choose an available action.",
    );
    if (id === "usurper") {
      requireRule(
        ["swap", "done"].includes(action.choice),
        "Exchange or keep identities.",
      );
      if (action.choice === "swap") {
        const [a, b] = q.targets.map((t) => player(g, t));
        [a.identity, b.identity] = [b.identity, a.identity];
        p.knowledge.push(
          ...[a, b].map((t) => ({
            playerId: t.id,
            name: t.name,
            identity: { ...t.identity },
            note: "After exchange",
          })),
        );
      }
      // Identical controls and announcement conceal the swap/keep decision.
      for (const targetId of q.targets) {
        const t = player(g, targetId);
        t.knownIdentity = null;
        t.publicIdentity = false;
      }
      log(g, "The Usurper has finished. Identities may have changed.");
      nextAction(g);
    } else if (id === "herald") {
      requireRule(
        ["done", "reveal"].includes(action.choice),
        "Reveal or keep the secret.",
      );
      if (action.choice === "reveal") {
        player(g, q.targets[0]).publicIdentity = true;
        log(g, `${p.name} reveals ${player(g, q.targets[0]).name}’s identity.`);
      }
      nextAction(g);
    } else if (c.type === "King’s Blade") {
      requireRule(
        ["kill", "spare"].includes(action.choice),
        "Kill or spare this courtier.",
      );
      if (action.choice === "kill") attack(g, p, player(g, q.targets[0]), id);
      else {
        log(g, `${p.name} spares ${player(g, q.targets[0]).name}.`);
        nextAction(g);
      }
    } else {
      requireRule(action.choice === "done", "Acknowledge the information.");
      nextAction(g);
    }
  } else if (q.kind === "recover") {
    requireRule(
      q.options.includes(action.cardId),
      "Choose one of the two discarded cards.",
    );
    const chosen = action.cardId;
    g.discard = g.discard.filter((c) => c !== chosen);
    p.hand.push(chosen);
    prompt(g, p, "recovered", { cardId: chosen });
  } else if (q.kind === "recovered") {
    requireRule(["now", "save"].includes(action.choice), "Play now or save.");
    const ci = categoryIndex(id);
    requireRule(
      action.choice === "save" || ci >= 0,
      "This card has special timing; save it for its trigger.",
    );
    if (action.choice === "now") {
      p.hand = p.hand.filter((c) => c !== id);
      p.played.push(id);
      beginCard(g, p, id);
    } else {
      requireRule(
        ci < 0 || ci >= g.phase,
        "This phase has passed. Play this card now.",
      );
      if (ci === g.phase) {
        p.hand = p.hand.filter((c) => c !== id);
        p.played.push(id);
        g.queue.push({ playerId: p.id, cardId: id });
        cardState(g, p.id, id, "waiting");
        g.queue.sort(
          (a, b) => CARD_MAP[a.cardId].order - CARD_MAP[b.cardId].order,
        );
      }
      nextAction(g);
    }
  } else if (q.kind === "react") {
    requireRule(
      action.choice === "skip" || q.options.includes(action.choice),
      "Choose an available reaction or skip.",
    );
    if (action.choice !== "skip") {
      p.hand = p.hand.filter((c) => c !== action.choice);
      p.played.push(action.choice);
      cardState(g, p.id, action.choice, "played");
      log(g, `${p.name} reveals ${CARD_MAP[action.choice].title}.`);
    }
    if (action.choice === "mirror") kill(g, player(g, q.attackerId));
    else {
      if (action.choice === "martyr") seal(p);
      kill(g, p);
    }
    nextAction(g);
  } else if (q.kind === "steal") {
    const t = player(g, q.targetId);
    requireRule(
      action.choice === "skip" || q.options.includes(action.tokenId),
      "Choose a seal or skip.",
    );
    if (action.choice !== "skip") {
      const token = t.tokens.find((t) => t.id === action.tokenId);
      t.tokens = t.tokens.filter((t) => t.id !== action.tokenId);
      p.tokens.push(token);
      log(g, `${p.name} takes one Royal Seal from ${t.name}.`);
    }
    nextAction(g);
  } else if (q.kind === "brokerInspect") {
    const t = player(g, q.targetId);
    let info = null,
      token = null;
    if (action.choice === "identity") info = inspect(p, t);
    else {
      requireRule(
        q.tokenIds.includes(action.tokenId),
        "Choose a seal to inspect.",
      );
      const x = t.tokens.find((x) => x.id === action.tokenId);
      token = { ...x };
    }
    prompt(g, p, "exchange", {
      cardId: id,
      targetId: t.id,
      info,
      token,
      theirIds: t.tokens.map((t) => t.id),
    });
  } else if (q.kind === "exchange") {
    requireRule(
      ["swap", "done"].includes(action.choice),
      "Exchange seals or finish.",
    );
    if (action.choice === "swap") {
      const t = player(g, q.targetId),
        mine = p.tokens.find((t) => t.id === action.mine),
        theirs = t.tokens.find((t) => t.id === action.theirs);
      requireRule(mine && theirs, "Select one seal from each courtier.");
      p.tokens = p.tokens.filter((t) => t.id !== mine.id);
      t.tokens = t.tokens.filter((t) => t.id !== theirs.id);
      p.tokens.push(theirs);
      t.tokens.push(mine);
      log(g, `${p.name} exchanges a Royal Seal with ${t.name}.`);
    }
    nextAction(g);
  } else fail("Unsupported action.");
  g.revision++;
}
export function scoreNight(g) {
  const living = g.players.filter((p) => p.alive);
  const kingmaker = living.find((p) => p.hand.includes("kingmaker"));
  let winningHouse = null,
    reason = "",
    tie = false;
  const ranks = Object.fromEntries(
    ["ashthorn", "stormwing"].map((h) => [
      h,
      living
        .filter((p) => p.identity.house === h)
        .map((p) => p.identity.rank)
        .sort((a, b) => a - b),
    ]),
  );
  if (kingmaker) {
    kingmaker.hand = kingmaker.hand.filter((c) => c !== "kingmaker");
    kingmaker.played.push("kingmaker");
    winningHouse =
      kingmaker.identity.house === "unsworn" ? null : kingmaker.identity.house;
    reason = `${kingmaker.name} survived as the Kingmaker. ${winningHouse ? HOUSES[winningHouse].name + " claims the night." : "Neither house receives a seal."}`;
  } else {
    for (
      let i = 0;
      i < Math.max(ranks.ashthorn.length, ranks.stormwing.length);
      i++
    ) {
      const a = ranks.ashthorn[i] ?? Infinity,
        b = ranks.stormwing[i] ?? Infinity;
      if (a !== b) {
        winningHouse = a < b ? "ashthorn" : "stormwing";
        reason = `At succession comparison ${i + 1}, ${HOUSES[winningHouse].name} has rank ${Math.min(a, b)}; the rival ${Number.isFinite(Math.max(a, b)) ? "has rank " + Math.max(a, b) : "has no remaining claimant"}.`;
        break;
      }
    }
    if (!winningHouse) {
      tie = true;
      reason =
        "The surviving bloodlines are completely tied. Every surviving courtier receives one seal.";
    }
  }
  const awards = [];
  for (const p of g.players) {
    const qualifies = tie
      ? p.alive
      : (winningHouse && p.identity.house === winningHouse) ||
        (p.alive && p.identity.house === "unsworn");
    if (qualifies) {
      seal(p);
      awards.push(p.id);
    }
    p.publicIdentity = true;
  }
  const high = Math.max(...g.players.map(prestige));
  g.winners =
    high >= 10
      ? g.players.filter((p) => prestige(p) === high).map((p) => p.id)
      : [];
  g.stage = g.winners.length ? "victory" : "dawn";
  g.prompt = null;
  g.presentation = null;
  g.activeCard = null;
  g.queue = [];
  g.result = {
    winningHouse,
    reason,
    ranks,
    awards,
    tie,
    kingmaker: kingmaker?.id ?? null,
  };
  log(g, reason);
}
export function viewFor(g, id) {
  const me = player(g, id);
  return {
    code: g.code,
    mode: g.mode,
    playMode: g.playMode,
    inviteOrigin: g.inviteOrigin,
    stage: g.stage,
    night: g.night,
    phase: g.phase,
    phaseName: PHASES[g.phase] ?? null,
    presentation: g.presentation ? { kind: g.presentation.kind } : null,
    activeCard: g.stage === "night" ? (g.activeCard ?? null) : null,
    hostId: g.hostId,
    revision: g.revision,
    paused: g.paused,
    votes: g.votes,
    result: g.result,
    winners: g.winners,
    players: g.players.map((p) => ({
      id: p.id,
      name: p.name,
      online: p.online,
      alive: p.alive,
      departed: !!p.departed,
      sealCount: p.tokens.length,
      ...(g.stage === "victory" ? { prestige: prestige(p) } : {}),
      played: p.played.map((c) => ({
        ...CARD_MAP[c],
        status:
          !p.alive && g.cardStates?.[`${p.id}:${c}`] === "waiting"
            ? "skipped"
            : (g.cardStates?.[`${p.id}:${c}`] ?? "played"),
      })),
      selected: p.selected,
      identity: p.publicIdentity ? p.identity : null,
    })),
    me: me
      ? {
          id: me.id,
          hand: me.hand.map((c) => CARD_MAP[c]),
          tokens: me.tokens,
          prestige: prestige(me),
          identity: me.knownIdentity,
          knowledge: me.knowledge,
          draft: me.draft.map((c) => CARD_MAP[c]),
          kept: me.kept.map((c) => CARD_MAP[c]),
          selected: me.selected,
        }
      : null,
    prompt: g.prompt?.playerId === id ? g.prompt : null,
    activePlayerId: g.prompt?.playerId ?? null,
    log: g.log.slice(-8),
  };
}
