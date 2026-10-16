import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import {
  newPlayer,
  createGame,
  startNight,
  viewFor,
  scoreNight,
} from "../server/game.js";

const origin = process.env.QA_URL || "http://localhost:3000";
const browser = await chromium.launch(
  process.env.QA_CHROME === "1"
    ? { channel: "chrome", headless: true }
    : { headless: true },
);
await mkdir("output/qa", { recursive: true });
const errors = [],
  report = [];
function watch(page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
}
async function shot(page, name) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `output/qa/${name}.png`, fullPage: true });
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  report.push({ name, ...metrics });
  if (metrics.scrollWidth > metrics.width)
    throw Error(`${name}: horizontal overflow`);
}
try {
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
    });
    watch(page);
    await page.goto(origin);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await shot(page, `home-${width}`);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByRole("button", { name: "How to Play", exact: true })
      .click();
    await page.getByRole("button", { name: "Next", exact: false }).click();
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.close();
  }
  // Reference states are served through a test-only WebSocket route; production has no debug endpoint.
  const ps = Array.from({ length: 10 }, (_, i) =>
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
  const session = { code: g.code, playerId: ps[0].id, secret: ps[0].secret };
  const variants = {};
  variants.identity = viewFor(g, ps[0].id);
  variants.draft = structuredClone(variants.identity);
  g.stage = "night";
  g.phase = 0;
  g.players.forEach((p, i) => {
    p.draft = [];
    p.hand = i === 0 ? ["informant-1", "mirror"] : ["blade-2"];
    p.selected = false;
    p.played = i === 1 ? ["informant-2"] : [];
  });
  g.prompt = {
    id: "qa",
    playerId: ps[0].id,
    kind: "target",
    cardId: "informant-1",
    count: 1,
  };
  variants.phase = viewFor(g, ps[0].id);
  g.prompt = {
    id: "react",
    playerId: ps[0].id,
    kind: "react",
    cardId: "blade-2",
    attackerId: ps[1].id,
    targetId: ps[0].id,
    options: ["mirror"],
  };
  variants.reaction = viewFor(g, ps[0].id);
  ps[1].alive = false;
  ps[4].alive = false;
  g.prompt = null;
  scoreNight(g);
  variants.dawn = viewFor(g, ps[0].id);
  g.stage = "victory";
  g.winners = [ps[0].id, ps[2].id];
  variants.victory = viewFor(g, ps[0].id);
  for (const [kind, state] of Object.entries(variants)) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript(
      (s) => localStorage.setItem("heir.session", JSON.stringify(s)),
      session,
    );
    const page = await context.newPage();
    watch(page);
    await page.routeWebSocket("**/*", (ws) =>
      ws.onMessage(() => ws.send(JSON.stringify({ type: "state", state }))),
    );
    await page.goto(origin);
    await page.waitForTimeout(300);
    await page.evaluate(() => document.fonts.ready);
    if (kind === "identity")
      await page
        .getByRole("button", { name: "Your secret allegiance" })
        .click();
    await shot(page, kind + "-390");
    await page.screenshot({
      path: `public/assets/help-${kind}.jpg`,
      fullPage: false,
    });
    if (kind === "phase") {
      await page.setViewportSize({ width: 320, height: 568 });
      await shot(page, "game-320x568");
      await page.setViewportSize({ width: 1440, height: 1000 });
      await shot(page, "game-desktop");
    }
    await context.close();
  }
  // Real clients: create, join, reorder, start, draft, complete each private prompt.
  const contexts = [],
    pages = [];
  for (let i = 0; i < 4; i++) {
    const c = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    contexts.push(c);
    const p = await c.newPage();
    pages.push(p);
    watch(p);
    await p.goto(origin);
    await p.locator("#name").fill(["Avery", "Maya", "Rowan", "Jules"][i]);
  }
  await pages[0].getByRole("button", { name: "Create a Court" }).click();
  await pages[0].locator(".room-code").waitFor();
  const code = (await pages[0].locator(".room-code").innerText()).trim();
  for (const p of pages.slice(1)) {
    await p.locator("#code").fill(code);
    await p.getByRole("button", { name: "Join", exact: false }).click();
    await p.locator(".seat-grid").waitFor();
  }
  await shot(pages[0], "lobby-live");
  await pages[0].getByRole("button", { name: "Seal the Palace" }).click();
  for (let round = 0; round < 2; round++) {
    for (const p of pages) {
      await p.locator(".draft-cards .game-card").first().click();
      await p.getByRole("button", { name: "Keep selected card" }).click();
    }
    await pages[0].waitForTimeout(100);
  }
  let steps = 0;
  while (++steps < 150) {
    if (await pages[0].locator(".dawn-screen").count()) break;
    let acted = false;
    for (const p of pages) {
      const q = JSON.parse(
        await p.evaluate(() => window.render_game_to_text()),
      ).yourAction;
      if (!q) continue;
      if (q.kind === "target") {
        const count = q.cardId === "usurper" ? 2 : 1;
        const targets = p.locator(".courtier.selectable");
        for (let i = 0; i < count; i++) await targets.nth(i).click();
        await p.getByRole("button", { name: /Confirm target/ }).click();
      } else if (q.kind === "inspect") {
        const button = p.locator(".prompt-modal .modal-actions button").first();
        await button.click();
      } else if (q.kind === "recover")
        await p.locator(".recover-cards button").first().click();
      else if (q.kind === "recovered") {
        const now = p.getByRole("button", { name: "Play Now", exact: true });
        if (await now.isEnabled()) await now.click();
        else await p.getByRole("button", { name: "Keep for Later" }).click();
      } else if (q.kind === "react")
        await p.locator(".react-cards button").first().click();
      else if (q.kind === "steal")
        await p.getByRole("button", { name: "Take this seal" }).click();
      else if (q.kind === "brokerInspect")
        await p
          .getByRole("button", { name: "Inspect identity", exact: true })
          .click();
      else if (q.kind === "exchange")
        await p
          .getByRole("button", { name: "Finish without exchanging" })
          .click();
      acted = true;
      await p.waitForTimeout(80);
      break;
    }
    if (!acted) await pages[0].waitForTimeout(100);
  }
  if (!(await pages[0].locator(".dawn-screen").count()))
    throw Error("Live round did not reach dawn");
  await shot(pages[0], "dawn-live");
  // Owner reconnect retains session and seals.
  const before = await pages[1].locator(".private-award").innerText();
  await pages[1].reload();
  await pages[1].locator(".private-award").waitFor();
  if ((await pages[1].locator(".private-award").innerText()) !== before)
    throw Error("Reconnect lost seals");
  // Consent before host transfer, followed by former-host rejoin.
  const hostSession = await pages[0].evaluate(() =>
    JSON.parse(localStorage.getItem("heir.session")),
  );
  await contexts[0].close();
  for (const p of pages.slice(1)) {
    await p.getByRole("button", { name: "Continue with a new host" }).waitFor();
    await p.getByRole("button", { name: "Continue with a new host" }).click();
  }
  await pages[1].getByRole("button", { name: "Begin Next Night" }).waitFor();
  const returned = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await returned.addInitScript(
    (s) => localStorage.setItem("heir.session", JSON.stringify(s)),
    hostSession,
  );
  const former = await returned.newPage();
  watch(former);
  await former.goto(origin);
  await former.locator(".dawn-screen").waitFor();
  if (await former.getByRole("button", { name: "Begin Next Night" }).count())
    throw Error("Former host unexpectedly reclaimed authority");
  await pages[1].getByRole("button", { name: "Begin Next Night" }).click();
  await former.locator(".draft-cards").waitFor();
  await returned.close();
  for (const c of contexts.slice(1)) await c.close();
  await writeFile(
    "output/qa/browser-report.json",
    JSON.stringify({ report, errors }, null, 2),
  );
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    JSON.stringify(
      {
        screenshots: report.length,
        liveRound: "passed",
        reconnect: "passed",
        consensualHostTransfer: "passed",
        consoleErrors: errors.length,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
