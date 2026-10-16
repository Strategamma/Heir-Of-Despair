import {
  CARDS,
  CARD_MAP,
  PHASES,
  HOUSES,
  categoryIndex,
} from "/shared/cards.js";

const $ = (s) => document.querySelector(s),
  app = $("#app"),
  modalRoot = $("#modal-root");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};
const savedName = read("heir.name", "");
const fragment = new URLSearchParams(location.hash.slice(1)),
  hint = fragment.get("arcadeName")?.trim();
if (fragment.has("arcadeName")) {
  fragment.delete("arcadeName");
  history.replaceState(
    null,
    "",
    location.pathname + location.search + (fragment.size ? "#" + fragment : ""),
  );
}
let name = savedName || (hint && hint.length <= 32 ? hint : "");
let session = read("heir.session", null),
  state = null,
  socket = null,
  config = { mode: "internet", lanAddresses: [] },
  connected = false,
  connecting = false,
  retry = null,
  retryCount = 0;
let screen = "home",
  modal = null,
  selectedCard = null,
  selectedTargets = [],
  identityOpen = false,
  busy = false,
  pendingIntent = null,
  lastPrompt = null,
  lastStage = null,
  installEvent = null,
  toastTimer,
  helpStep = 0,
  referenceType = "All",
  exitAfterLeave = false,
  stayOnHome = read("heir.atHome", false);
let settings = read("heir.settings", { sound: true, reduced: false });
document.documentElement.classList.toggle("reduce-motion", settings.reduced);
const paths = {
  crown: "M3 7l5 4 4-7 4 7 5-4-2 13H5L3 7zm3 10h12",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  moon: "M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10z",
  dagger: "M12 2l4 10-4 3-4-3 4-10zm0 3v8M6 15h12M10 15v5h4v-5M10 22h4",
  sword:
    "M12 1l3 4v10l-3 2-3-2V5l3-4zm0 3v11M6 16l2-1 4 2 4-2 2 1M12 17v4M10 22h4",
  rose: "M12 2l3 2 4 1 1 4 2 3-3 3-1 4-4 1-2 2-3-3-4-1-1-4-2-2 3-3 1-4 4-1 2-2zM12 6l5 3-1 6-4 3-5-3V9l5-3zm0 3l2 2-1 3-3-1v-3l2-1z",
  falcon: "M12 11L2 4l3 10 7 4 7-4 3-10-10 7zm0 0V4m-3 16l3-2 3 2",
  masks: "M3 4l8 2v9c-5 5-8 0-8-3V4zm10 4l8-2v10c0 5-5 7-8 2M5 9h2m8 3h3",
  urn: "M8 3h8M9 3v4c-9 4-5 13 3 13s12-9 3-13V3M8 23h8",
  scroll: "M6 4h12v16H6zm3 4h6m-6 4h6m-6 4h3",
  scales: "M12 3v18M5 7h14M5 7l-4 8h8L5 7zm14 0l-4 8h8l-4-8zM8 21h8",
  key: "M14 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm-4 9l-7 8m2-3l3 2m-1-5l3 2",
  mirror: "M12 2c-11 0-11 16 0 16S23 2 12 2zm-3 7l6-4m-3 13v4m-4 0h8",
  heart:
    "M12 6C7-1 0 6 5 12l7 6 7-6c5-6-2-13-7-6zM12 2v12m-3-3l3 3 3-3M12 19l-1 2a1 1 0 0 0 2 0l-1-2z",
  settings:
    "M10 2h4l1 4 4-1 2 4-3 3 3 3-2 4-4-1-1 4h-4l-1-4-4 1-2-4 3-3-3-3 2-4 4 1 1-4zm2 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  download: "M12 3v12m-5-5l5 5 5-5M4 16v5h16v-5",
  arrow: "M4 12h16m-6-6l6 6-6 6",
  close: "M6 6l12 12M6 18L18 6",
  users:
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-3c0-6 14-6 14 0v3M17 4c5 0 5 7 0 7m2 4c3 1 3 3 3 6",
  wifi: "M2 8c6-6 14-6 20 0M5 12c4-4 10-4 14 0m-11 4c2-2 6-2 8 0m-4 4h.01",
  globe:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 0c-6 5-6 15 0 20 6-5 6-15 0-20zM2 12h20",
  book: "M12 5c-3-3-7-3-10-1v15c3-2 7-2 10 1 3-3 7-3 10-1V4c-3-2-7-2-10 1zm0 0v15",
  seal: "M12 2l3 3 4 1 1 4 2 2-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-2 1-4 4-1 3-3zm-3 7h6v6H9z",
};
function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.crown}"/></svg>`;
}
function btn(text, action, cls = "primary", attrs = "") {
  return `<button class="${cls}" data-action="${action}" ${attrs}>${text}</button>`;
}
function houseLabel(id) {
  return id
    ? `${HOUSES[id.house].name}${id.rank ? " · Rank " + id.rank : ""}`
    : "Identity unknown";
}
function header() {
  return `<header class="topbar"><a href="/" class="arcade game-brand" data-action="home-exit" aria-label="Heir of Despair home"><img class="brand-logo" src="/assets/wordmark.png" width="135" height="90" alt="Heir of Despair"></a><div class="top-tools"><span class="connection ${connected ? "on" : ""}" title="${connected ? "Connected" : "Not connected"}">${state ? (connected ? "Court connected" : "Reconnecting…") : "A GAME OF HIDDEN LOYALTIES"}</span>${btn(icon("download"), "install", "icon-button", 'aria-label="Install game" title="Install game"')}${btn(icon("settings"), "settings", "icon-button", 'aria-label="Settings" title="Settings"')}</div></header>`;
}
function logo() {
  return `<div class="wordmark"><img src="/assets/wordmark.png" alt="Heir of Despair" fetchpriority="high"><span class="sr-only">Heir of Despair</span></div>`;
}
function home() {
  return `<main class="home"><div class="home-story"><div class="eyebrow"><span></span>THE THRONE STANDS EMPTY<span></span></div>${logo()}<p class="story-line">Everyone bows.<br><em>No one is loyal.</em></p><p class="story-description">The sovereign is dead. Two houses keep vigil.<br>Before dawn, one will claim the kingdom.</p><div class="house-marks"><span class="ashthorn">${icon("rose")} ASHTHORN</span><span class="versus">✦</span><span class="stormwing">${icon("falcon")} STORMWING</span></div></div><section class="home-panel glass"><div class="panel-flourish">${icon("crown")}</div><p class="eyebrow">A NIGHT OF ROYAL AMBITION</p><h1>Take your place <br>in the court.</h1><p class="muted">Trust is a luxury. Choose your company.</p><div class="mode-switch" role="group" aria-label="Connection mode">${btn(icon("globe") + " Internet", "internet", config.mode === "internet" ? "mode active" : "mode")}${btn(icon("wifi") + " Same Wi-Fi", "lan", config.mode === "lan" ? "mode active" : "mode")}</div><label class="field-label" for="name">YOUR COURT NAME</label><input id="name" name="nickname" autocomplete="nickname" maxlength="32" placeholder="What shall we call you?" value="${esc(name)}">${session ? btn("Return to your court " + icon("arrow"), "resume", "primary rejoin") : ""}${btn(icon("crown") + " Create a Court " + icon("arrow"), "create", "primary wide")}<div class="or"><span></span>OR ENTER A ROOM CODE<span></span></div><form id="join-form" class="join-row"><input id="code" aria-label="Room code" autocomplete="off" maxlength="5" placeholder="A B C D E" value="${esc(new URLSearchParams(location.search).get("room") || "")}"><button class="secondary" type="submit">Join ${icon("arrow")}</button></form><div class="home-details"><span>${icon("users")} 4–10 players</span><span>◷ 15–20 min</span><span>${icon("wifi")} Together in person</span></div><button class="text-button help-link" data-action="help">${icon("book")} New to the court? Learn to play</button><p class="mode-note">${config.mode === "lan" ? "Local palace server · All devices on the same Wi-Fi" : "Play together in one room · Internet required"}</p></section><footer class="home-footer"><span>SECRETS ARE YOUR WEAPONS. SURVIVAL IS YOUR CLAIM.</span><span>HEADPHONES OFF. SUSPICIONS ON.</span></footer></main>`;
}
const cardStatusLabel = (status) =>
  ({
    waiting: "Waiting",
    playing: "Playing now",
    played: "Played",
    skipped: "Unable to act",
  })[status] || "Played";
function playerTile(p, i, selectable = false) {
  const me = p.id === state.me.id,
    identity = p.identity;
  return `<button data-seat="${p.id}" class="courtier ${!p.alive ? "dead" : ""} ${selectedTargets.includes(p.id) ? "targeted" : ""} ${selectable ? "selectable" : ""} ${state.activePlayerId === p.id ? "acting" : ""} ${identity?.house || ""}" ${selectable ? `data-target="${p.id}"` : "disabled"} ${selectable ? `aria-pressed="${selectedTargets.includes(p.id)}"` : ""} aria-label="${esc(p.name)}${!p.alive ? ", eliminated" : ""}${selectable ? ", select target" : ""}"><span class="seat-heading">SEAT ${i + 1}${me ? " · YOU" : ""}${p.departed ? " · DEPARTED" : !p.online ? " · OFFLINE" : ""}</span><strong>${esc(p.name)}</strong><span class="life-status ${p.alive ? "alive" : "fallen"}">${p.alive ? "● Alive" : "✕ Fallen"}</span><span class="courtier-meta">${identity ? esc(houseLabel(identity)) : "Identity concealed"}</span><span class="seal-count">${p.sealCount} ${p.sealCount === 1 ? "Royal Seal" : "Royal Seals"}</span><span class="played-strip">${p.played.length ? p.played.map((c) => `<span class="public-card ${c.status || "played"}"><strong>${icon(c.symbol)}<span>${esc(c.title)}${c.order ? " · " + c.order : ""}</span></strong><small>${cardStatusLabel(c.status)}</small></span>`).join("") : '<span class="no-reveals">No cards revealed</span>'}</span></button>`;
}
function phaseRoster() {
  const revealed = state.players
    .flatMap((p, seat) =>
      p.played
        .filter((c) => c.type === state.phaseName)
        .map((card) => ({ p, seat, card })),
    )
    .sort(
      (a, b) => (a.card.order ?? 0) - (b.card.order ?? 0) || a.seat - b.seat,
    );
  return `<section class="phase-roster" aria-label="Revealed ${esc(state.phaseName)} cards"><div class="roster-heading"><h2>Revealed ${esc(state.phaseName)} cards</h2><span>Lowest number acts first</span></div>${revealed.length ? `<div class="roster-cards">${revealed.map(({ p, seat, card }) => `<button class="revealed-card ${card.status || "played"}" data-action="inspect-card" data-id="${card.id}"><span class="reveal-owner">SEAT ${seat + 1} · ${esc(p.name)}</span><strong>${icon(card.symbol)}<span>${esc(card.title)}${card.order ? " · " + card.order : ""}</span></strong><span class="reveal-status">${cardStatusLabel(!p.alive && card.status === "waiting" ? "skipped" : card.status)}</span></button>`).join("")}</div>` : "<p>No living players revealed a card in this category.</p>"}</section>`;
}
function lobby() {
  return `<main class="court-layout lobby"><div class="section-heading"><p class="eyebrow">THE ANTECHAMBER</p><h1>The court is gathering.</h1><p class="muted">Find your seat. Tonight, everyone has something to hide.</p></div><section class="glass lobby-main"><div class="room-line"><div><p class="eyebrow">INVITE YOUR COURT</p><button class="room-code" data-action="copy" title="Copy invitation">${state.code}<span>${icon("scroll")}</span></button><p class="room-route">${state.mode === "lan" ? "Local invite address selected automatically" : "Hosted court · Internet required"}</p></div><span class="pill">${icon(state.mode === "lan" || state.playMode === "same-wifi" ? "wifi" : "globe")} ${state.mode === "lan" ? "Same Wi-Fi · Local" : state.playMode === "same-wifi" ? "Same Wi-Fi · Online" : "Internet"}</span></div><div class="seat-grid">${state.players.map((p, i) => `<div class="seat-card"><span class="seat-number">${i + 1}</span><div class="seat-sigil">${icon("crown")}</div><strong>${esc(p.name)}</strong><span class="muted">${p.id === state.hostId ? "Host" : p.online ? "Seated" : "Reconnecting"}</span>${state.hostId === state.me.id && i > 0 ? btn("←", "seat-left", "icon-button seat-move", `data-id="${p.id}" aria-label="Move ${esc(p.name)} one seat earlier"`) : ""}</div>`).join("")}${Array.from({ length: Math.max(0, 4 - state.players.length) }, () => '<div class="seat-card empty">' + icon("users") + "<span>Awaiting a courtier</span></div>").join("")}</div><p class="seating-note">${icon("arrow")} Draft passes left through seats 1 → ${state.players.length} → 1.<br>Match these seats to your room before the first bell.</p>${state.hostId === state.me.id ? btn("Seal the Palace " + icon("arrow"), "start", "primary wide", state.players.length < 4 || state.players.some((p) => !p.online && !p.departed) ? "disabled" : "") : '<p class="waiting"><span class="pulse-dot"></span> Waiting for the host to seal the palace</p>'}<div class="lobby-bottom"><span>${state.players.length}/10 seated · Minimum 4</span>${btn("Leave court", "leave", "text-button")}</div></section><aside class="lobby-aside"><div class="rule-teaser">${icon("masks")}<h2>Two houses.<br>One empty throne.</h2><p>Your allegiance is secret. Your allies may be strangers. Keep your house’s closest claimant alive.</p></div><div class="rule-teaser">${icon("seal")}<h2>Win the night.<br>Earn your claim.</h2><p>The winning house earns Royal Seals. Reach 10 Prestige to become heir. Even fallen allies share the spoils.</p></div>${btn("A guide to surviving court " + icon("arrow"), "help", "text-button")}</aside></main>`;
}
function cardView(
  c,
  {
    select = false,
    selected = false,
    small = false,
    action = "choose-card",
  } = {},
) {
  return `<${select ? "button" : "article"} class="game-card ${small ? "small" : ""} ${selected ? "chosen" : ""} type-${PHASES.indexOf(c.type)} ${c.type === "Reaction" ? "reaction-card" : ""}" ${select ? `data-action="${action}" data-id="${c.id}"` : ""}><div class="card-top"><span>${esc(c.type)}</span><b class="card-number">${c.order ?? (c.type === "Reaction" ? "↶" : "✦")}</b></div><div class="card-art">${icon(c.symbol)}<span class="art-orbit"></span></div><div class="card-copy"><h3>${esc(c.title)}</h3><p>${esc(c.ability)}</p></div><div class="card-foot">${select ? (selected ? "SELECTED · KEEP THIS CARD" : "TAP TO SELECT") : c.type === "Reaction" ? "PLAY WHEN TRIGGERED" : c.type === "Dawn" ? "REVEAL IF ALIVE AT DAWN" : "RESOLVES IN NUMBER ORDER"}</div></${select ? "button" : "article"}>`;
}
function identityPanel() {
  return `<div class="identity-pill ${identityOpen ? state.me.identity?.house || "" : ""}">${btn(icon("eye") + (identityOpen ? esc(houseLabel(state.me.identity)) : "Your secret allegiance"), "identity", "text-button allegiance-button")}${identityOpen && !state.me.identity ? "<small>The Usurper inspected your identity. It may have changed; you cannot reopen it.</small>" : ""}</div>`;
}
function draftScreen() {
  const first = state.stage === "draft1",
    me = state.players.find((p) => p.id === state.me.id),
    idx = state.players.indexOf(me),
    left = state.players[(idx + 1) % state.players.length];
  return `<main class="draft-screen"><div class="game-topline"><span class="eyebrow">NIGHT ${state.night} · THE DRAFT</span>${identityPanel()}</div><div class="section-heading"><p class="eyebrow">${first ? "01 · CHOOSE YOUR FIRST CARD" : "02 · CHOOSE YOUR SECOND CARD"}</p><h1>${state.me.selected ? "Your choice is sealed." : "Prepare for the night."}</h1><p class="muted">${state.me.selected ? "Waiting for the remaining courtiers to choose." : first ? `Keep one. Pass the other two to ${esc(left.name)} on your left.` : "Keep one of these two cards. The other goes to the discard pile."}</p></div>${!state.me.selected ? `<div class="draft-cards">${state.me.draft.map((c) => cardView(c, { select: true, selected: selectedCard === c.id })).join("")}</div><div class="draft-confirm">${btn("Keep selected card " + icon("arrow"), "keep", "primary", !selectedCard ? "disabled" : "")}</div>` : `<div class="sealed-choice">${icon("scroll")}<h2>A secret worth keeping.</h2><div class="draft-status">${state.players.map((p) => `<span class="${p.selected ? "ready" : ""}">${p.selected ? "✓" : "◌"} ${esc(p.name)}</span>`).join("")}</div></div>`}<div class="draft-bottom">${state.me.kept.length ? `<section class="draft-kept"><span class="eyebrow">YOUR HAND · KEPT CARDS</span><div class="hand-cards">${state.me.kept.map((c) => cardView(c, { small: true })).join("")}</div></section>` : "<span>You will enter the night with two cards.</span>"}<span>${icon("arrow")} Pass to <strong>${esc(left.name)}</strong></span></div></main>`;
}
function targetAllowed(p) {
  const q = state.prompt;
  if (q?.kind !== "target") return false;
  const c = CARD_MAP[q.cardId];
  if (
    !["usurper", "justiciar"].includes(c.id) &&
    !["Cutthroat", "King’s Blade"].includes(c.type) &&
    p.id === state.me.id
  )
    return false;
  if (
    (["Cutthroat", "King’s Blade"].includes(c.type) || c.id === "justiciar") &&
    !p.alive
  )
    return false;
  if (c.id === "thief" && p.sealCount <= state.me.tokens.length) return false;
  return true;
}
function actionHeading() {
  if (state.presentation?.kind === "phase")
    return {
      title: `Calling all ${["Informants", "Oracles", "Conspirators", "Cutthroats", "King’s Blades"][state.phase]}`,
      text: "Cards reveal together. Abilities resolve in number order.",
    };
  if (state.presentation?.kind === "resolution")
    return {
      title: "The court bears witness.",
      text: state.log.at(-1) || "The action is complete.",
    };
  const q = state.prompt;
  if (!q) {
    const who = state.players.find((p) => p.id === state.activePlayerId);
    return {
      title: who ? `${who.name} is deciding.` : "The court moves in shadows.",
      text: state.activeCard
        ? `${CARD_MAP[state.activeCard.cardId].title}: ${CARD_MAP[state.activeCard.cardId].ability} Private findings stay with the player.`
        : "Watch the court. What you learn may save your house.",
    };
  }
  const c = CARD_MAP[q.cardId];
  return {
    title:
      q.kind === "react"
        ? "Your life hangs by a thread."
        : `${c.title}${c.order ? " · " + c.order : ""}`,
    text:
      q.kind === "target"
        ? `Choose ${q.count === 2 ? "two courtiers" : "one courtier"} from the court below.`
        : q.kind === "react"
          ? "A legal reaction is glowing. Play it, or accept your fate."
          : c.ability,
  };
}
function nightScreen() {
  const h = actionHeading(),
    active = state.activeCard && CARD_MAP[state.activeCard.cardId];
  return `<main class="play-screen"><div class="game-topline"><div class="phase-track" aria-label="Night order">${PHASES.map((p, i) => `<span class="${i === state.phase ? "current" : i < state.phase ? "past" : ""}" ${i === state.phase ? 'aria-current="step"' : ""} title="${p}">${i + 1}<span>${p}</span></span>`).join("")}</div><span class="eyebrow">NIGHT ${state.night}</span></div><section class="action-banner ${state.prompt ? "your-action" : ""}"><div><p class="eyebrow">${state.prompt ? "YOUR " + (state.prompt.kind === "react" ? "REACTION" : "TURN") : esc(state.phaseName) + " PHASE"}</p><h1>${esc(h.title)}</h1><p>${esc(h.text)}</p></div>${state.prompt ? '<span class="action-indicator">' + icon(CARD_MAP[state.prompt.cardId].symbol) + "</span>" : ""}</section>${active ? `<section class="active-card-summary"><span class="eyebrow">${state.activeCard.playerId === state.me.id ? "YOUR ACTIVE CARD" : esc(state.players.find((p) => p.id === state.activeCard.playerId)?.name) + " · ACTIVE CARD"}</span><strong>${icon(active.symbol)} ${esc(active.title)} ${active.order ?? ""}</strong><p>${esc(active.ability)}</p></section>` : ""}${phaseRoster()}${state.prompt?.kind === "target" ? `<div class="target-confirm">${btn("Confirm " + (selectedTargets.length > 1 ? "targets" : "target") + " " + icon("arrow"), "confirm-target", "primary", selectedTargets.length !== state.prompt.count ? "disabled" : "")}</div>` : ""}<div class="court-grid">${state.players.map((p, i) => playerTile(p, i, targetAllowed(p))).join("")}</div><section class="player-dock"><div class="dock-title"><span class="eyebrow">YOUR HAND</span>${identityPanel()}${btn(icon("seal") + ` ${state.me.prestige}/10 Prestige`, "tokens", "text-button prestige-button")}</div><div class="hand-cards">${state.me.hand.length ? state.me.hand.map((c) => cardView(c, { select: true, small: true, action: "inspect-card" })).join("") : '<p class="muted">Your cards are revealed on the table above.</p>'}</div><details class="court-history"><summary>Court activity</summary><ol>${state.log.map((line) => `<li>${esc(line)}</li>`).join("")}</ol></details><p class="recent-event" aria-live="polite">${esc(state.log.at(-1) || "")}</p></section></main>`;
}
function finalStandings() {
  const players = [...state.players].sort(
    (a, b) =>
      b.prestige - a.prestige ||
      state.players.indexOf(a) - state.players.indexOf(b),
  );
  return `<section class="final-standings" aria-label="Final scores"><h2>The final reckoning</h2><p>All final totals are revealed. Each seal kept its original value.</p><table><thead><tr><th scope="col">Courtier</th><th scope="col">Royal Seals</th><th scope="col">Prestige</th></tr></thead><tbody>${players.map((p) => `<tr class="${state.winners.includes(p.id) ? "crowned" : ""}"><th scope="row">${state.winners.includes(p.id) ? icon("crown") : ""}${esc(p.name)}${p.id === state.me.id ? " <small>(you)</small>" : ""}${state.winners.includes(p.id) ? '<small class="heir-label">' + (state.winners.length > 1 ? "JOINT HEIR" : "HEIR") + "</small>" : ""}</th><td>${p.sealCount}</td><td><strong>${p.prestige}</strong><small>points</small></td></tr>`).join("")}</tbody></table></section>`;
}
function kingmakerDecree() {
  const r = state.result,
    maker = state.players.find((p) => p.id === r.kingmaker),
    house = r.winningHouse;
  const recipients = state.players.filter((p) => r.awards.includes(p.id));
  return `<section class="kingmaker-decree" aria-label="Kingmaker decree"><div class="decree-card">${icon("crown")}<span>DAWN CARD</span><strong>The Kingmaker</strong><span>Survived with ${esc(maker.name)}</span></div><div class="decree-copy"><p class="eyebrow">SUCCESSION RANKS OVERRIDDEN</p><h2>${house ? HOUSES[house].name + " is crowned" : "Neither house is crowned"}</h2><p>${house ? `${esc(maker.name)} belongs to ${HOUSES[house].name}. Their surviving Kingmaker card awards the night to that house, regardless of ranks.` : `${esc(maker.name)} is Unsworn. Their surviving Kingmaker card denies both houses a victory.`}</p><p class="decree-rewards">${house ? `Every ${HOUSES[house].name} player receives one Royal Seal, including fallen allies.${recipients.some((p) => p.identity.house === "unsworn") ? " A surviving Unsworn also earns one survival seal." : ""}` : "Neither house receives a Royal Seal. The living Unsworn earns one survival seal."}</p><p class="decree-recipients"><strong>Seal recipients:</strong> ${recipients.map((p) => esc(p.name)).join(", ") || "None"}</p></div></section>`;
}
function dawnScreen() {
  const r = state.result,
    victory = state.stage === "victory",
    names = state.winners.map(
      (id) => state.players.find((p) => p.id === id)?.name,
    ),
    house = r.winningHouse,
    kingmaker = state.players.find((p) => p.id === r.kingmaker);
  return `<main class="dawn-screen ${house || ""} ${kingmaker ? "kingmaker-outcome" : ""}"><div class="dawn-rays" aria-hidden="true"></div><div class="dawn-heading"><p class="eyebrow">${victory ? "THE THRONE IS CLAIMED" : kingmaker ? "THE KINGMAKER HAS SPOKEN · NIGHT " + state.night : "THE GATES OPEN · NIGHT " + state.night}</p><div class="victory-crest">${icon(victory || kingmaker ? "crown" : house === "ashthorn" ? "rose" : house === "stormwing" ? "falcon" : "scales")}</div><h1>${victory ? esc(names.join(" & ")) : kingmaker ? (house ? `${esc(kingmaker.name)} crowns <span class="${house}">${HOUSES[house].name}</span>.` : `${esc(kingmaker.name)} denies both houses.`) : house ? HOUSES[house].name : "The court stands divided."}</h1><p class="victory-subtitle">${victory ? (names.length > 1 ? "Joint heirs to the kingdom." : "The kingdom has found its heir.") : kingmaker ? (house ? `${HOUSES[house].name} wins by royal decree.` : "The Unsworn denies both houses the throne.") : house ? "The night belongs to you." : "No bloodline stands above the other."}</p></div><section class="glass dawn-results"><p class="eyebrow">${victory ? "A CLAIM PROVEN IN PRESTIGE" : kingmaker ? "THE DECISIVE CARD" : r.tie ? "A DRAW · SURVIVORS EARN SEALS" : "WHY THE NIGHT WAS WON"}</p>${kingmaker ? kingmakerDecree() : `<p class="dawn-reason">${esc(r.reason)}</p><div class="rank-comparison">${["ashthorn", "stormwing"].map((h) => `<div class="${h}">${icon(h === "ashthorn" ? "rose" : "falcon")}<strong>${HOUSES[h].name}</strong><span>${r.ranks[h].length ? r.ranks[h].map((n) => `<b>${n}</b>`).join("") : "No survivors"}</span></div>`).join("")}</div>`}${victory ? finalStandings() : `<div class="awards-list">${state.players.map((p) => `<div class="award-row ${p.identity.house} ${r.awards.includes(p.id) ? "awarded" : ""}"><span>${icon(p.identity.house === "ashthorn" ? "rose" : p.identity.house === "stormwing" ? "falcon" : "crown")}<strong>${esc(p.name)} <b class=public-rank>${p.identity.rank ?? "✦"}</b></strong><small class="award-house">${esc(HOUSES[p.identity.house].name)} · ${p.alive ? "Survived" : "Fallen"}</small></span><span>${r.awards.includes(p.id) ? "<b>+1 seal</b>" : "—"}<small>${p.sealCount} total</small></span></div>`).join("")}</div>`}<p class="private-award">${icon("seal")} Your Prestige: <strong>${state.me.prestige} / 10</strong>${r.awards.includes(state.me.id) ? ` · New seal: <strong>${state.me.tokens.at(-1).value}</strong>` : ""}</p>${state.hostId === state.me.id ? btn((victory ? "Gather a New Court" : "Begin Next Night") + " " + icon("arrow"), victory ? "rematch" : "start", "primary wide", state.players.some((p) => !p.online && !p.departed) ? "disabled" : "") : `<p class="waiting">Waiting for ${esc(state.players.find((p) => p.id === state.hostId)?.name)} to ${victory ? "gather the court" : "begin the next night"}.</p>`}${state.players.some((p) => !p.online && !p.departed) ? '<p class="muted">A seat is disconnected. Waiting for them to return.</p>' : ""}</section></main>`;
}
function departedControls() {
  if (!state || !["draft1", "draft2", "night", "dawn"].includes(state.stage)) return "";
  const missing = state.players.filter((p) => !p.online && !p.departed);
  if (!missing.length) return "";
  const host = state.hostId === state.me.id;
  const remaining = state.players.filter((p) => !p.departed).length;
  return `<section class="glass departure-panel" aria-label="Disconnected seats"><h2>A seat is disconnected</h2><p>Wait for them to return${host ? ", or resolve their departure." : ". The host can resolve a permanent departure."}</p>${missing.map((p) => `<div class="departure-row"><strong>${esc(p.name)}</strong>${host && remaining > 4 ? btn("Mark dead and continue", "depart-seat", "secondary", `data-id="${p.id}"`) : ""}</div>`).join("")}${host ? `${remaining <= 4 ? '<p>Fewer than four would remain. Continuing without this seat is unavailable.</p>' : '<p class="muted">Departed players fall this night and are excluded from the next deal.</p>'}${btn("Abandon game", "abandon", "secondary")}` : ""}</section>`;
}
function abandonedScreen() {
  return `<main class="court-layout"><section class="glass departure-panel"><p class="eyebrow">THE VIGIL HAS ENDED</p><h1>Game abandoned.</h1><p>The host ended this match. No further seals were awarded.</p>${state.hostId === state.me.id ? btn("Gather a New Court", "rematch", "primary") : "<p>Return home or wait for the host to gather a new court.</p>"}${btn("Return home", "leave", "secondary")}</section></main>`;
}
function pausePanel() {
  return `<div class="connection-overlay"><section class="glass"><p class="eyebrow">THE VIGIL IS PAUSED</p><h2>${!connected ? "Reconnecting to your court…" : "The host has disconnected."}</h2><p>Your place and the court’s secrets remain reserved while the server is running.</p>${connected ? `<p>All connected players must agree to continue with a new host. Seats, cards and seals stay the same.</p>${btn(state.votes.includes(state.me.id) ? "You agreed · awaiting the court" : "Continue with a new host", "continue", "primary", state.votes.includes(state.me.id) ? "disabled" : "")}` : '<span class="pulse-dot"></span>'}<p class="muted">${connected ? state.votes.length + " players agreed" : "If the server restarted, this court may no longer exist."}</p></section></div>`;
}
let lastVisual = null;
function animateCourt() {
  if (!state) {
    lastVisual = null;
    return;
  }
  const current = {
    court: `${state.code}:${state.night}`,
    stage: state.stage,
    phase: state.phase,
    active: state.activeCard
      ? `${state.activeCard.playerId}:${state.activeCard.cardId}`
      : null,
    selected: [...selectedTargets],
    kept: state.me.kept.map((c) => c.id),
    players: state.players.map((p) => ({
      id: p.id,
      alive: p.alive,
      seals: p.sealCount,
      played: p.played.map((c) => c.id),
    })),
  };
  const old = lastVisual?.court === current.court ? lastVisual : null;
  lastVisual = current;
  if (
    settings.reduced ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const motion = (el, frames, duration = 550, delay = 0) =>
    el?.animate(frames, {
      duration,
      delay,
      easing: "cubic-bezier(.18,.75,.2,1)",
      fill: "backwards",
    });
  if (
    state.presentation?.kind === "phase" &&
    (old?.phase !== current.phase || old?.stage !== "night")
  ) {
    motion(
      app.querySelector(".action-banner"),
      [
        { opacity: 0, transform: "translateY(14px) scale(.98)" },
        { opacity: 1, transform: "none" },
      ],
      700,
    );
    motion(
      app.querySelector(".phase-track .current"),
      [
        { boxShadow: "0 0 0 0 #d4af6580" },
        { boxShadow: "0 0 0 12px #d4af6500" },
      ],
      1000,
    );
  }
  if (current.active && old?.active !== current.active) {
    motion(
      app.querySelector(".active-card-summary"),
      [
        {
          opacity: 0,
          transform: "perspective(800px) rotateX(-22deg) translateY(10px)",
        },
        { opacity: 1, transform: "none" },
      ],
      650,
    );
  }
  for (const p of current.players) {
    const previous = old?.players.find((x) => x.id === p.id),
      tile = app.querySelector(`[data-seat="${p.id}"]`);
    if (previous?.alive && !p.alive) {
      motion(
        tile,
        [
          { filter: "brightness(1.6)", transform: "translateY(-3px)" },
          { filter: "brightness(.7)", transform: "translateY(3px)" },
          { filter: "none", transform: "none" },
        ],
        950,
      );
      tile?.classList.add("newly-fallen");
    }
    if (previous && p.seals > previous.seals)
      motion(
        tile?.querySelector(".seal-count"),
        [
          { transform: "scale(1.25)", color: "#ffe5a0" },
          { transform: "scale(1)", color: "inherit" },
        ],
        800,
      );
    if (previous && p.played.length > previous.played.length) {
      tile?.querySelectorAll(".played-strip > span").forEach((el, i) => {
        if (i >= previous.played.length)
          motion(
            el,
            [
              { opacity: 0, transform: "perspective(400px) rotateY(90deg)" },
              { opacity: 1, transform: "none" },
            ],
            600,
            (i - previous.played.length) * 80,
          );
      });
    }
    if (current.selected.includes(p.id) && !old?.selected.includes(p.id))
      motion(
        tile,
        [
          { transform: "scale(.96)" },
          { transform: "scale(1.025)" },
          { transform: "scale(1)" },
        ],
        350,
      );
  }
  if (current.stage.startsWith("draft") && old?.stage !== current.stage) {
    app.querySelectorAll(".draft-cards .game-card").forEach((el, i) =>
      motion(
        el,
        [
          {
            opacity: 0,
            transform: "perspective(700px) rotateY(-16deg) translateY(15px)",
          },
          { opacity: 1, transform: "none" },
        ],
        550,
        i * 70,
      ),
    );
  }
  if (current.kept.length > (old?.kept.length ?? 0))
    motion(
      app.querySelector(".draft-kept .game-card:last-child"),
      [
        { opacity: 0, transform: "translateY(-16px) rotate(-5deg)" },
        { opacity: 1, transform: "none" },
      ],
      600,
    );
  if (
    ["dawn", "victory"].includes(current.stage) &&
    old?.stage !== current.stage
  ) {
    motion(
      app.querySelector(".victory-crest"),
      [
        { opacity: 0, transform: "scale(.75) rotate(-8deg)" },
        { opacity: 1, transform: "none" },
      ],
      850,
    );
    app
      .querySelectorAll(".award-row.awarded, .final-standings tbody tr")
      .forEach((el, i) =>
        motion(
          el,
          [
            { opacity: 0, transform: "translateY(12px)" },
            { opacity: 1, transform: "none" },
          ],
          600,
          i * 75,
        ),
      );
  }
}
function render() {
  const focus = document.activeElement?.id,
    selection = document.activeElement?.selectionStart;
  document.body.classList.toggle("in-game", !!state);
  document.body.classList.toggle(
    "at-dawn",
    ["dawn", "victory"].includes(state?.stage),
  );
  app.innerHTML =
    header() +
    departedControls() +
    (state
      ? state.stage === "lobby"
        ? lobby()
        : state.stage.startsWith("draft")
          ? draftScreen()
          : state.stage === "night"
            ? nightScreen()
            : state.stage === "abandoned" ? abandonedScreen() : dawnScreen()
      : home()) +
    (state && (!connected || state.paused) ? pausePanel() : "");
  animateCourt();
  if (focus && $("#" + focus)) {
    const el = $("#" + focus);
    el.focus();
    if (typeof selection === "number")
      try {
        el.setSelectionRange(selection, selection);
      } catch {}
  }
  renderModal();
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 5000);
}
function send(message) {
  if (!connected) {
    toast("Reconnecting. Your action has not been sent.");
    return;
  }
  socket.send(JSON.stringify(message));
}
function action(data) {
  if (!state?.prompt) return;
  send({ type: "action", action: { ...data, promptId: state.prompt.id } });
}
function returnHome() {
  stayOnHome = true;
  save("heir.atHome", true);
  clearTimeout(retry);
  pendingIntent = null;
  exitAfterLeave = false;
  const previous = socket;
  socket = null;
  if (previous) {
    previous.onopen =
      previous.onmessage =
      previous.onclose =
      previous.onerror =
        null;
    previous.close();
  }
  connected = connecting = false;
  state = null;
  modal = null;
  selectedTargets = [];
  selectedCard = null;
  lastPrompt = lastStage = null;
  render();
}
function connect(intent) {
  stayOnHome = false;
  save("heir.atHome", false);
  if (connected) {
    if (intent) send(intent);
    return;
  }
  if (intent) pendingIntent = intent;
  if (connecting) return;
  connecting = true;
  socket = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`,
  );
  socket.onopen = () => {
    connected = true;
    connecting = false;
    retryCount = 0;
    if (pendingIntent) {
      send(pendingIntent);
      pendingIntent = null;
    } else if (session) send({ type: "resume", ...session });
    render();
  };
  socket.onmessage = (e) => {
    let m;
    try {
      m = JSON.parse(e.data);
    } catch {
      return;
    }
    if (m.type === "session") {
      session = { code: m.code, playerId: m.playerId, secret: m.secret };
      save("heir.session", session);
    }
    if (m.type === "state") {
      const old = state;
      state = m.state;
      if (state.presentation?.kind === "phase" && old?.phase !== state.phase)
        chime(330 + state.phase * 55);
      busy = false;
      if (lastStage !== state.stage) {
        selectedCard = null;
        selectedTargets = [];
        identityOpen = false;
        lastStage = state.stage;
        if (["night", "dawn", "victory"].includes(state.stage))
          chime(state.stage === "night" ? 220 : 440);
      }
      if (lastPrompt !== state.prompt?.id) {
        selectedTargets = [];
        lastPrompt = state.prompt?.id;
        if (modal?.kind === "prompt") modal = null;
      }
      if (state.prompt && state.prompt.kind !== "target")
        modal = { kind: "prompt" };
      else if (modal?.kind === "prompt") modal = null;
      if (
        old?.players.some(
          (p) => p.alive && !state.players.find((t) => t.id === p.id)?.alive,
        )
      )
        chime(110);
      render();
      if (!modal) modalRoot.innerHTML = "";
    } else if (m.type === "error") {
      exitAfterLeave = false;
      busy = false;
      toast(m.message);
    } else if (m.type === "sessionExpired") {
      session = null;
      state = null;
      save("heir.session", null);
      toast(
        "This court has expired or the server restarted. Create or join a new court.",
      );
      render();
    } else if (m.type === "left") {
      const goHome = exitAfterLeave;
      exitAfterLeave = false;
      if (modal?.kind === "exit") modal = null;
      state = null;
      session = null;
      save("heir.session", null);
      render();
      if (goHome) returnHome();
    } else if (m.type === "replaced") {
      session = null;
      state = null;
      save("heir.session", null);
      toast("Your seat was opened in another tab.");
      render();
    }
  };
  socket.onclose = () => {
    exitAfterLeave = false;
    connected = false;
    connecting = false;
    render();
    if (session && !stayOnHome) {
      clearTimeout(retry);
      retry = setTimeout(
        () => connect(),
        Math.min(1000 * 2 ** retryCount++, 12000),
      );
    }
  };
  socket.onerror = () => {
    connecting = false;
    toast("Could not reach the palace server. Check your connection.");
  };
}
function captureName() {
  const input = $("#name");
  if (input) name = input.value.trim();
  if (!name || name.length > 32) {
    toast("Enter your court name (1–32 characters).");
    input?.focus();
    return false;
  }
  save("heir.name", name);
  return true;
}
function openModal(kind, data = {}) {
  modal = { kind, ...data };
  renderModal();
  requestAnimationFrame(() =>
    modalRoot.querySelector("button,input,select")?.focus(),
  );
}
function closeModal() {
  if (modal?.kind === "prompt") {
    toast("Complete this choice to continue the night.");
    return;
  }
  const fromExit = modal?.kind === "exit";
  modal = null;
  modalRoot.innerHTML = "";
  app.inert = false;
  app
    .querySelector(fromExit ? ".game-brand" : '[data-action="settings"]')
    ?.focus();
}
function tokenButtons(ids, prefix) {
  return `<div class="token-choices">${ids.map((id, i) => `<label class="token-choice"><input type="radio" name="${prefix}" value="${esc(id)}" ${i === 0 ? "checked" : ""}><span>${icon("seal")}${prefix === "mine" ? state.me.tokens.find((t) => t.id === id)?.value : "?"}<small>Seal ${i + 1}</small></span></label>`).join("")}</div>`;
}
function promptContents() {
  const q = state.prompt;
  if (!q) return "";
  const c = CARD_MAP[q.cardId],
    target = state.players.find((p) => p.id === q.targetId);
  let body = `<p class="eyebrow">PRIVATE CHOICE · ${esc(c.type)}</p><h2>${esc(c.title)}</h2>`;
  if (q.kind === "inspect") {
    body +=
      "<p>Only you can see this information.</p>" +
      q.info
        .map(
          (info) =>
            `<div class="secret-result ${info.identity.house}">${icon(info.identity.house === "ashthorn" ? "rose" : info.identity.house === "stormwing" ? "falcon" : "crown")}<span>${esc(info.name)}<strong>${esc(houseLabel(info.identity))}</strong></span></div>`,
        )
        .join("");
    if (c.type === "Oracle")
      body += q.glimpse
        ? `<p class="eyebrow">A RANDOM CARD FROM THEIR HAND</p>${cardView(q.glimpse, { small: true })}`
        : "<p>No unrevealed cards remain in their hand.</p>";
    const opts =
      c.id === "usurper"
        ? [
            ["swap", "Exchange identities"],
            ["done", "Keep identities"],
          ]
        : c.id === "herald"
          ? [
              ["reveal", "Reveal to the court"],
              ["done", "Keep it secret"],
            ]
          : c.type === "King’s Blade"
            ? [
                ["kill", "Kill this courtier"],
                ["spare", "Spare this courtier"],
              ]
            : [["done", "Commit to memory"]];
    body += `<div class="modal-actions">${opts.map(([id, t]) => btn(t, "choice", id === opts[0][0] ? "primary" : "secondary", `data-choice="${id}"`)).join("")}</div>`;
  } else if (q.kind === "recover")
    body += `<p>Inspect these two discarded cards. Choose one to recover.</p><div class="recover-cards">${q.options.map((id) => cardView(CARD_MAP[id], { select: true, action: "recover" })).join("")}</div>`;
  else if (q.kind === "recovered") {
    const ci = categoryIndex(c.id);
    body +=
      cardView(c, { small: true }) +
      `<div class="modal-actions">${btn("Play Now", "choice", "primary", `data-choice="now" ${ci < 0 ? "disabled" : ""}`)}${btn("Keep for Later", "choice", "secondary", `data-choice="save" ${ci >= 0 && ci < state.phase ? "disabled" : ""}`)}</div><p class="muted">${ci < 0 ? "This card waits for its special trigger." : ci < state.phase ? "Its phase has passed; play it now." : "Saving keeps the card for its eligible phase."}</p>`;
  } else if (q.kind === "react")
    body += `<p>${esc(state.players.find((p) => p.id === q.attackerId)?.name)} is about to kill you. Choose your response.</p><div class="react-cards">${q.options.map((id) => cardView(CARD_MAP[id], { select: true, action: "reaction" })).join("")}</div>${btn("Skip · accept the attack", "choice", "secondary wide", 'data-choice="skip"')}`;
  else if (q.kind === "steal")
    body += `<p>Choose one of ${esc(target.name)}’s face-down seals. Its value stays fixed.</p>${tokenButtons(q.options, "theirs")}<div class="modal-actions">${btn("Take this seal", "steal", "primary")}${btn("Skip", "choice", "secondary", 'data-choice="skip"')}</div>`;
  else if (q.kind === "brokerInspect")
    body += `<p>Inspect ${esc(target.name)}’s identity or one of their seals.</p>${btn("Inspect identity", "choice", "primary wide", 'data-choice="identity"')}${q.tokenIds.length ? tokenButtons(q.tokenIds, "theirs") + btn("Inspect selected seal", "broker-token", "secondary wide") : ""}`;
  else if (q.kind === "exchange")
    body += `${q.info ? `<div class="secret-result ${q.info.identity.house}"><strong>${esc(houseLabel(q.info.identity))}</strong></div>` : `<div class="secret-result">${icon("seal")} Inspected seal: <strong>${q.token.value} Prestige</strong></div>`}<p>You may exchange any one of your seals with any one of ${esc(target.name)}’s seals.</p>${
      state.me.tokens.length && q.theirIds.length
        ? `<p class="eyebrow">YOUR SEALS</p>${tokenButtons(
            state.me.tokens.map((t) => t.id),
            "mine",
          )}<p class="eyebrow">THEIR SEALS</p>${tokenButtons(q.theirIds, "theirs")}${btn("Exchange selected seals", "exchange", "primary wide")}`
        : "<p>Both players need at least one seal to exchange.</p>"
    }${btn("Finish without exchanging", "choice", "secondary wide", 'data-choice="done"')}`;
  return body;
}
const helpSteps = [
  [
    "Gather",
    "Take your seat",
    "lobby",
    [
      "Create a court and share its room code. Friends enter the code to join.",
      "The host arranges seats to match the room. Cards pass left in this order.",
      "With 4–10 players present, the host seals the palace to begin.",
    ],
    "Playing together on Wi-Fi? Choose Same Wi-Fi to create a coded court automatically.",
  ],
  [
    "Identity",
    "Know your secret",
    "identity",
    [
      "Open Your secret allegiance privately. Remember your house and rank, then hide it.",
      "Rank 1 is the strongest claim. Your house wants its best-ranked members to survive.",
      "An odd-sized court includes the Unsworn: survive alone to earn a Royal Seal.",
    ],
    "Identities are dealt again each night. Your Royal Seals stay with you.",
  ],
  [
    "Draft",
    "Choose two cards",
    "draft",
    [
      "Choose one of three cards and confirm. The other two pass to the named player on your left.",
      "Receive two cards from your right. Keep one; the remaining card goes to the hidden discard pile.",
      "You now have two cards. Everyone completes each choice before the draft advances.",
    ],
    "Read the ability and printed number before choosing. Lower numbers act first within a category.",
  ],
  [
    "Night",
    "Act when called",
    "phase",
    [
      "Informants inspect another identity. Oracles inspect an identity and one random unplayed card from that same player.",
      "Conspirators use their individual powers. Cutthroats kill. King’s Blades inspect, then kill or spare that same target.",
      "Each category reveals together. The public list names every owner and card, in number order. Follow Waiting → Playing now → Played; inspect any revealed card by tapping it.",
    ],
    "The order is Informant → Oracle → Conspirator → Cutthroat → King’s Blade. Fallen players can still talk, but cannot act.",
  ],
  [
    "Reactions",
    "Answer a killing blow",
    "reaction",
    [
      "If your reaction can respond to an attack, it glows and the game asks you to play or skip it.",
      "Mirror Warden turns the kill onto the attacker. Royal Martyr awards you a seal, but you still die.",
      "Without a legal reaction, the attack resolves immediately. High Justiciar bypasses both reactions.",
    ],
    "Fallen players are marked clearly on the table. Their secret identity remains hidden until dawn.",
  ],
  [
    "Dawn",
    "See why your house won",
    "dawn",
    [
      "All identities are revealed. Compare the houses’ living ranks: 1 beats 2, and so on.",
      "If the best ranks match, compare the next best survivors. Kingmaker can override ordinary succession.",
      "Every member of the winning house earns one seal, including the fallen. A living Unsworn also earns one.",
    ],
    "If the surviving bloodlines tie completely, all survivors earn a seal.",
  ],
  [
    "Seals",
    "Keep your Prestige secret",
    "seals",
    [
      "Each Royal Seal has a fixed value of 2–4 Prestige. Open Your Royal Seals in Settings to see yours.",
      "Everyone sees your number of seals. Only you see their values and your total Prestige.",
      "Stealing or exchanging moves the actual seal: its value stays the same. Rewards are all resolved before checking victory.",
    ],
    "If nobody wins the match, the host starts the next night from the dawn screen.",
  ],
  [
    "Coronation",
    "Claim the empty throne",
    "victory",
    [
      "At the end of a night, players with at least 10 Prestige qualify for the throne.",
      "The highest qualifying total wins. Equal highest totals are crowned joint heirs.",
      "A house can win many nights, but the final crown belongs to the individual heir—or joint heirs.",
    ],
    "Reaching 10 during an ability does not end the night early. Other powers can still change the outcome.",
  ],
];
function helpContent() {
  const [tab, title, shot, steps, tip] = helpSteps[helpStep];
  return `<p class="eyebrow">A GUIDE TO THE COURT</p><h2>Learn the game</h2><div class="guide-tabs" role="tablist" aria-label="Game sections">${helpSteps.map(([label], i) => `<button id="guide-tab-${i}" role="tab" aria-selected="${i === helpStep}" aria-controls="guide-panel" tabindex="${i === helpStep ? 0 : -1}" data-help="${i}">${label}</button>`).join("")}</div><section id="guide-panel" role="tabpanel" aria-labelledby="guide-tab-${helpStep}" class="guide-panel"><div class="guide-instructions"><p class="eyebrow">${helpStep + 1} / ${helpSteps.length} · ${tab}</p><h3>${title}</h3><ol>${steps.map((text) => `<li>${esc(text)}</li>`).join("")}</ol><p class="guide-tip">${esc(tip)}</p></div><figure class="help-screenshot"><a href="/assets/help-${shot}.jpg" target="_blank" rel="noopener" aria-label="View ${esc(tab)} screenshot full size"><img src="/assets/help-${shot}.jpg" alt="${esc(title)}: current game interface" width="390" height="844"></a><figcaption>${esc(tab)} · tap image to enlarge</figcaption></figure></section><div class="modal-actions">${btn("← Previous", "help-prev", "secondary", helpStep === 0 ? "disabled" : "")}${btn(helpStep === helpSteps.length - 1 ? "Card reference" : "Next " + icon("arrow"), helpStep === helpSteps.length - 1 ? "reference" : "help-next", "primary")}</div>`;
}
function renderModal() {
  app.inert = !!modal;
  if (!modal) {
    modalRoot.innerHTML = "";
    return;
  }
  let body = "";
  const locked = modal.kind === "prompt";
  if (locked) body = promptContents();
  else if (modal.kind === "departure")
    body = `<h2>${modal.playerId ? "Mark this player dead?" : "Abandon this game?"}</h2><p>${modal.playerId ? "Their remaining choices are skipped. They remain fallen for this night, may still receive their house’s normal reward, and cannot rejoin this match. They leave before the next deal." : "This ends the match for everyone without awarding further seals."}</p><div class="modal-actions">${btn("Cancel", "close", "secondary")}${btn(modal.playerId ? "Mark dead and continue" : "Abandon game", "confirm-departure", "primary")}</div>`;
  else if (modal.kind === "exit")
    body = `<p class="eyebrow">RETURN TO HEIR OF DESPAIR HOME</p><h2>Leave your seat?</h2><p>${state?.stage === "lobby" && connected ? "Your seat will be removed from this lobby before you leave." : "Your seat and Royal Seals stay reserved. Return from this browser to rejoin while the server is running. The host can mark a disconnected player dead and exclude them from the next night, or abandon the game."}</p>${state && state.stage !== "lobby" && state.hostId === state.me.id ? '<p class="muted">As host, leaving pauses play until you return or the connected players unanimously approve a new host. The new host can resolve your departure.</p>' : ""}<div class="modal-actions">${btn("Stay in the court", "close", "primary")}${btn("Leave and go home", "confirm-home-exit", "secondary")}</div>`;
  else if (modal.kind === "settings")
    body = `<p class="eyebrow">MAKE YOURSELF AT HOME</p><h2>Court settings</h2><label class="field-label" for="settings-name">YOUR COURT NAME</label><div class="join-row"><input id="settings-name" maxlength="32" value="${esc(state ? state.players.find((p) => p.id === state.me.id).name : name)}">${btn("Save", "save-name", "secondary")}</div><label class="toggle-row">Sound effects<input id="sound-toggle" type="checkbox" ${settings.sound ? "checked" : ""}></label><label class="toggle-row">Reduce motion<input id="motion-toggle" type="checkbox" ${settings.reduced ? "checked" : ""}></label>${btn(icon("book") + " How to Play", "help", "secondary wide")}${btn(icon("scroll") + " All cards & powers", "reference", "secondary wide")}${state ? btn(icon("seal") + " Your Royal Seals", "tokens", "secondary wide") : ""}<p class="muted">${config.mode === "lan" ? "Connected to a local palace server." : "Hosted play requires Internet."} Disconnected seats can rejoin while this server remains running. Server restarts end existing courts.</p>`;
  else if (modal.kind === "help") body = helpContent();
  else if (modal.kind === "reference")
    body = `<p class="eyebrow">THE INSTRUMENTS OF SUCCESSION</p><h2>Cards of the court</h2><nav class="reference-tabs">${["All", ...PHASES, "Reaction", "Dawn"].map((t) => `<button data-filter="${esc(t)}" class="${referenceType === t ? "active" : ""}">${esc(t)}</button>`).join("")}</nav><div class="reference-cards">${CARDS.filter(
      (c) => referenceType === "All" || c.type === referenceType,
    )
      .map((c) => cardView(c, { small: true }))
      .join("")}</div>`;
  else if (modal.kind === "tokens")
    body = `<p class="eyebrow">FOR YOUR EYES ONLY</p><h2>Your Royal Seals</h2><p>Your total is private. Other courtiers see only your seal count.</p><div class="private-tokens">${state.me.tokens.map((t) => `<span>${icon("seal")}<strong>${t.value}</strong></span>`).join("") || "<p>No seals yet. Win a night to earn your first.</p>"}</div><h3>${state.me.prestige} / 10 Prestige</h3><p class="muted">Coronation is checked after all end-of-night rewards.</p>`;
  else if (modal.kind === "card") body = cardView(CARD_MAP[modal.id]);
  else if (modal.kind === "install")
    body = `<p class="eyebrow">KEEP THE PALACE CLOSE</p><h2>Install Heir of Despair</h2><p>On iPhone or iPad, open this site in Safari, tap Share, then Add to Home Screen. On Android or desktop, use your browser’s Install app menu.</p><p class="muted">Install from the public HTTPS address. Multiplayer still needs a reachable game server. A local Wi-Fi HTTP address is for browser play.</p>`;
  modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal glass ${modal.kind === "reference" ? "reference-modal" : ""} ${locked ? "prompt-modal" : ""} ${modal.kind === "help" ? "guide-modal" : ""}" role="dialog" aria-modal="true" aria-label="${locked ? "Private card choice" : esc(modal.kind)}">${!locked ? btn(icon("close"), "close", "icon-button modal-close", 'aria-label="Close dialog"') : ""}${body}</section></div>`;
  if (!modalRoot.contains(document.activeElement)) {
    modalRoot
      .querySelector(
        "button:not(:disabled):not([tabindex='-1']), input, a[href]",
      )
      ?.focus();
  }
}
document.addEventListener("input", (e) => {
  if (e.target.id === "name") {
    name = e.target.value;
    save("heir.name", name);
  }
  if (e.target.id === "code")
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "");
});
document.addEventListener("change", (e) => {
  if (e.target.id === "sound-toggle") {
    settings.sound = e.target.checked;
    save("heir.settings", settings);
  }
  if (e.target.id === "motion-toggle") {
    settings.reduced = e.target.checked;
    save("heir.settings", settings);
    document.documentElement.classList.toggle(
      "reduce-motion",
      settings.reduced,
    );
  }
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "join-form") {
    e.preventDefault();
    if (captureName()) {
      const code = $("#code").value.trim().toUpperCase();
      if (code.length !== 5) {
        toast("Enter the five-character room code.");
        return;
      }
      connect({ type: "join", name, code });
    }
  }
});
document.addEventListener("click", async (e) => {
  const target = e.target.closest("[data-target]");
  if (target) {
    const id = target.dataset.target;
    selectedTargets = selectedTargets.includes(id)
      ? selectedTargets.filter((t) => t !== id)
      : state.prompt.count === 1
        ? [id]
        : [...selectedTargets, id].slice(-2);
    render();
    return;
  }
  const help = e.target.closest("[data-help]");
  if (help) {
    helpStep = Number(help.dataset.help);
    renderModal();
    modalRoot.querySelector(`#guide-tab-${helpStep}`)?.focus();
    return;
  }
  const filter = e.target.closest("[data-filter]");
  if (filter) {
    referenceType = filter.dataset.filter;
    renderModal();
    return;
  }
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  if (a === "home-exit") {
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0 ||
      (!state && (!session || stayOnHome))
    )
      return;
    e.preventDefault();
    openModal("exit");
  } else if (a === "confirm-home-exit") {
    if (state?.stage === "lobby" && connected) {
      if (!exitAfterLeave) {
        exitAfterLeave = true;
        send({ type: "leave" });
      }
    } else returnHome();
  } else if (a === "create") {
    if (captureName()) connect({ type: "create", name });
  } else if (a === "resume") connect({ type: "resume", ...session });
  else if (
    a === "settings" ||
    a === "help" ||
    a === "reference" ||
    a === "tokens"
  )
    openModal(a);
  else if (a === "save-name") {
    const value = $("#settings-name").value.trim();
    if (!value || value.length > 32) {
      toast("Use a name of 1–32 characters.");
      return;
    }
    name = value;
    save("heir.name", name);
    if (state) send({ type: "rename", name });
    else render();
    toast("Court name saved.");
  } else if (a === "close") closeModal();
  else if (a === "internet") {
    if (config.mode === "lan")
      toast(
        "This is a local server. Open the public game address for Internet courts.",
      );
  } else if (a === "lan") {
    // A room opens immediately; its local/hosted route is resolved by the server.
    const field = $("#name");
    if (field && !field.value.trim()) field.value = "Guest";
    if (captureName()) connect({ type: "create", name, playMode: "same-wifi" });
  } else if (a === "install") {
    if (installEvent) {
      await installEvent.prompt();
      installEvent = null;
    } else openModal("install");
  } else if (a === "start") send({ type: "start" });
  else if (a === "depart-seat" || a === "abandon") {
    openModal("departure");
    modal.playerId = a === "depart-seat" ? el.dataset.id : null;
    renderModal();
  } else if (a === "confirm-departure") {
    send(modal.playerId ? { type: "depart-seat", playerId: modal.playerId } : { type: "abandon" });
    closeModal();
  }
  else if (a === "rematch") send({ type: "rematch" });
  else if (a === "continue") send({ type: "continue" });
  else if (a === "leave") send({ type: "leave" });
  else if (a === "copy") {
    try {
      await navigator.clipboard.writeText(
        `${state.inviteOrigin || location.origin}/?room=${state.code}`,
      );
      toast("Court invitation copied.");
    } catch {
      toast("Room code: " + state.code);
    }
  } else if (a === "seat-left") {
    const ids = state.players.map((p) => p.id),
      i = ids.indexOf(el.dataset.id);
    [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
    send({ type: "reorder", ids });
  } else if (a === "identity") {
    identityOpen = !identityOpen;
    render();
  } else if (a === "choose-card") {
    selectedCard = el.dataset.id;
    render();
  } else if (a === "keep") {
    if (selectedCard)
      send({ type: "action", action: { type: "draft", cardId: selectedCard } });
  } else if (a === "confirm-target") action({ targets: selectedTargets });
  else if (a === "choice") action({ choice: el.dataset.choice });
  else if (a === "recover") action({ cardId: el.dataset.id });
  else if (a === "reaction") action({ choice: el.dataset.id });
  else if (a === "steal")
    action({
      tokenId: modalRoot.querySelector("[name=theirs]:checked")?.value,
    });
  else if (a === "broker-token")
    action({
      tokenId: modalRoot.querySelector("[name=theirs]:checked")?.value,
    });
  else if (a === "exchange")
    action({
      choice: "swap",
      mine: modalRoot.querySelector("[name=mine]:checked")?.value,
      theirs: modalRoot.querySelector("[name=theirs]:checked")?.value,
    });
  else if (a === "inspect-card") openModal("card", { id: el.dataset.id });
  else if (a === "help-next") {
    helpStep = Math.min(helpSteps.length - 1, helpStep + 1);
    renderModal();
  } else if (a === "help-prev") {
    helpStep = Math.max(0, helpStep - 1);
    renderModal();
  }
});
document.addEventListener("keydown", (e) => {
  if (
    modal?.kind === "help" &&
    e.target.matches('[role="tab"]') &&
    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
  ) {
    e.preventDefault();
    helpStep =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? helpSteps.length - 1
          : (helpStep + (e.key === "ArrowRight" ? 1 : -1) + helpSteps.length) %
            helpSteps.length;
    renderModal();
    modalRoot.querySelector(`#guide-tab-${helpStep}`).focus();
    return;
  }
  if (e.key === "Escape") closeModal();
  if (modal && e.key === "Tab") {
    const items = [
        ...modalRoot.querySelectorAll(
          "button:not(:disabled):not([tabindex='-1']), input, a[href]",
        ),
      ],
      first = items[0],
      last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
});
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
});
window.addEventListener("online", () => {
  if (session && !connected && !stayOnHome) connect();
});
let audio;
function chime(freq) {
  if (!settings.sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(),
      gain = audio.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    gain.gain.setValueAtTime(0.055, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 1.2);
    o.connect(gain);
    gain.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 1.2);
  } catch {}
}
document.addEventListener(
  "pointerdown",
  () => {
    if (settings.sound) {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume().catch(() => {});
    }
  },
  { once: true },
);
window.render_game_to_text = () =>
  JSON.stringify(
    state
      ? {
          stage: state.stage,
          night: state.night,
          phase: state.phaseName,
          players: state.players.map((p) => ({
            name: p.name,
            alive: p.alive,
            sealCount: p.sealCount,
            identity: p.identity,
          })),
          yourAction: state.prompt
            ? { kind: state.prompt.kind, cardId: state.prompt.cardId }
            : null,
          connection: connected ? "connected" : "reconnecting",
        }
      : { stage: "home", mode: config.mode },
  );
window.advanceTime = async () => {};
fetch("/api/config")
  .then((r) => r.json())
  .then((c) => {
    config = c;
    render();
  })
  .catch(() => {});
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
render();
if (session && !stayOnHome) connect();
