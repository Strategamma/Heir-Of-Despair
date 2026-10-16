# Heir of Despair

A mobile/PC social deduction PWA for 4–10 friends in the same room. Two hidden houses fight over an empty throne; individual players accumulate private Prestige across nights. Includes a restrained dark interface, a dimensional crown-and-dagger wordmark, 33 action cards, drafting, contextual reactions, faction celebrations, and shared coronations.

## Run

Requires Node.js 22+.

```sh
npm ci
npm start
```

Open http://localhost:3000. Each player needs a separate browser profile/device. Tabs in the same browser share a seat and replace one another intentionally. Use `PORT=4178 npm start` if another game or old service worker occupies port 3000.

Create a court, share its five-character code, arrange the seats, and start with 4–10 connected players. Pass direction follows seat order, not screen position. All clients connect to the same authoritative server.

## Same Wi-Fi / LAN

```sh
npm run lan
```

The host opens the game locally and taps **Same Wi-Fi**. A court and five-character code are created immediately; the server automatically chooses a private Wi-Fi invite address. Copy the court invitation to the other players; opening it takes them to that local server with the code prefilled. Nobody is asked to find or type an IP address. The host computer must stay running and allow the port through its firewall. Router client isolation can block device-to-device access. This mode does not need Internet after dependencies are installed. It does not discover rooms automatically or make the hosted HTTPS app connect to an insecure private WebSocket. Open the local address directly in a browser.

Install the PWA from its public HTTPS origin. Local private-IP HTTP is browser play, not an installable secure PWA origin. On the public hosted version, Same Wi-Fi instead creates a coded room on the existing service and requires Internet. It cannot discover or start a separate local server from a public HTTPS page.

## Render / GitHub

Push this project to the chosen GitHub repository, then create a Render Blueprint from `render.yaml`, or configure a Node web service:

| Setting | Value |
| --- | --- |
| Build | `npm ci --omit=dev` |
| Start | `npm start` |
| Health | `/health` |
| Environment | `NODE_ENV=production`, `TABLE_MODE=internet` |
| Port | Render supplies `PORT` |

The front end and WebSocket share one origin. HTTPS automatically uses `wss://`. Configure the chosen game subdomain in Render/DNS; no final public URL or GitHub repository has been assigned yet. Do not list it as live in Decadence Arcade until hosted multiplayer and real-device checks pass.

**Persistence boundary:** live courts live in server memory. Reloads and temporary disconnections recover seats, cards and seals while the process remains alive. A host disconnect pauses the court; all connected players must consent before host control transfers. Restarting/redeploying the server destroys existing courts. Free hosting may cold-start or restart. Durable restart recovery requires an external persistent store and is not implemented or promised by this version.

## PWA / names

The service worker caches the interface, art, card reference and illustrated guide. Multiplayer still needs a reachable server. A new deployment is fetched from the network; a waiting worker takes over when old game tabs close. Bump the cache version when changing the offline shell.

Arcade launch fragment `#arcadeName=...` prefills an editable nickname and is removed without dropping other fragment fields. It is never authentication. Generated opaque seat secrets authorize reconnection and actions. Host-only commands and private-state projections are enforced server-side.

## Verify

```sh
npm test
npm run check
npx playwright install chromium
node scripts/browser-qa.js
```

Start the game server before browser QA. `QA_CHROME=1` selects installed Google Chrome. Tests include 100 randomized matches, card exceptions, private information, traversal/origin protection, reconnect and host transfer. Browser QA captures narrow/desktop screens, produces real-interface help screenshots using test fixtures, and exercises four actual browser seats through a full round. Fixtures exist only in the test browser's intercepted socket; production exposes no debug endpoints.

The unchanged skill browser client is copied to `scripts/web-game-client.mjs` so it resolves this project's Playwright version. The original external client expected a different browser build. Development-only `scripts/court-companions.js URL CODE COUNT` joins automated seats for manual UI verification; it is not a player-facing bot mode.

See [rules](docs/RULES.md), [verification](docs/VERIFICATION.md), and [asset provenance](public/assets/PROVENANCE.md). The wordmark is rendered dimensional artwork, not a runtime 3D model.
