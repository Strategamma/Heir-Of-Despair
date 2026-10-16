# Verification — 2026-10-16

## Correction pass: card contract, quiet backgrounds, card symbols and Same Wi-Fi

- `npm test`: **96 passed**. Includes 57 isolated card-contract checks, all numbered variants, optional effects and forbidden side effects; six address-selection checks; a real hosted Same Wi-Fi create/join request; and the existing 100-match simulation/server checks.
- Usurper swap/keep now produces identical public and affected-owner projections. Both targets lose identity access either way, as explicitly requested. The identity message no longer claims an exchange definitely occurred.
- In-app browser: throne artwork absent from computed backgrounds; 390×844 home fits without horizontal/vertical overflow. Conspirator category, sword, dagger and pierced-heart icons inspected at desktop and phone widths. All six King's Blade number badges measured 24×24 with centered alignment in the reference view.
- Same Wi-Fi click created a five-character coded court immediately from localhost and displayed the automatically selected local route; no address-entry control exists. Hosted creation stays Internet-backed; network tests ensure it does not expose an internal LAN address or pretend to discover one. Real-router/second-phone invitation remains unverified.
- Card reference and text guide are updated. Existing help screenshots depict the earlier interface and need regeneration during the help-page review. No new external browser run was requested after the earlier decline; current visual checks used the in-app browser.

## Earlier implementation checks

- `npm test`: 32 tests passed. Includes 100 randomized full matches across 4–10 seats, all 33 cards/catalogue structure, left-pass draft, private projections, stale/wrong-seat actions, inspection/swap/recovery, self-inspection after identity exchange, both reactions, Justiciar bypass, token transfers, tie comparison, Unsworn/Kingmaker rewards and joint heirs.
- Actual Node WebSocket server tests: create/join, host-only commands, seat reorder, host-loss pause, unanimous transfer, former-host rejoin, invalid seat credential, rename; origin rejection, health/manifest/modules and encoded path traversal protection. Separate LAN-mode server health/config/static checks passed (same machine; not physical LAN).
- `npm run check`: server, rules and browser JavaScript syntax passed.
- First external Chrome pass: four independent browser profiles created/joined, drafted, played a complete night to dawn; reload recovered the same seat/seals; all remaining players consented to host transfer; former host rejoined without reclaiming control; next night began. No gameplay exceptions. Six resource errors were missing help images that this same pass subsequently generated. The full browser pass was not repeated after those images and layout fixes because the external rerun was declined.
- Screenshots inspected: home at 320/390/1440, draft/private identity at 390, 10-seat court at 320/390/1440, reactions, dawn and victory. That first visual pass found vertical overflow; subsequent CSS corrects the affected views.
- In-app browser follow-up on dedicated port 4178: revised 390×844 home has no page overflow; illustrated help accessible from Settings; actual 10-seat WebSocket court created and drafted; revised 320×568 active court fits exactly (scrollHeight 568, scrollWidth 320), with hand and target confirmation visible. Private identity inspection, triggered Martyr reaction/death/seal award, Kingmaker faction override, dawn rewards and host-controlled next night exercised. No error/warning logs. Other seats were development protocol peers, not physical phones. Settings dialog correctly isolates keyboard/accessibility focus and returns it on close.
- Original skill client was attempted. Initial external installation lacked its expected Chromium; project-local copy resolved the dependency, but the downloaded headless shell crashed on missing ICU resources. Installed Chrome and the in-app browser provided the browser evidence above.

## Still open before release

- Live Render deployment, custom domain and GitHub publication are not configured.
- Physical phones on a real router, firewall/client-isolation behavior, real touch/audio/safe areas, browser-specific PWA installation and installed launch.
- Deployed cold start, fresh/updated/offline PWA visits and complete live multi-phone match.
- Complete browser regression pass after final layout/help adjustments. In-app checks are narrower than the full automated script.
- Room state is process-local. Server restart recovery is not supported; disclose this hosting limit or add a durable external store before promising it.

## Court guide refresh — 2026-10-16

Eight named topic tabs replace dots, with roving keyboard focus, numbered instructions, current screenshots and full-size image links. Captured current UI through loopback-only example server, not production debug routes. In-app browser inspected at 390×844 and 1440×1000 without horizontal overflow; all eight topic images loaded, arrow-key selection worked, and Settings access remained available. Syntax checks and all 96 rules/server tests passed. A live four-seat court with three development peers is prepared for game-screen review. Physical phones, installed PWA update and production remain unverified.

## Court clarity pass — 2026-10-16

House-coloured allegiance, retained draft cards, active ability, full phase names, public target/activity history, and a geometric Ashthorn rosette replace the previous UI. Draft heading confirmed as “Prepare for the night.” Production rooms opt into server-controlled 2800ms phase and 2400ms outcome barriers. Two new tests cover deadlines, private projections, pause, and empty-category calls; all 98 tests and syntax checks pass. In-app browser observed a live four-seat draft, retained card, blue allegiance, public action pause and own active ability. Inspected 390×844, 320×568 and 1440×1000; no horizontal overflow, target confirmation visible. Compact phones scroll to remaining hand/history; ten-seat 390px courts likewise keep action/targets above the hand. All eight guide JPGs recaptured from current UI. Physical devices and deployment unverified.

## Final totals and game feel — 2026-10-16

Final coronation standings reveal every player’s aggregate Prestige and seal count, sorted by score with joint-heir markers. Other stages expose no opponent totals and token values remain private. New projection regression brings suite to 99 passing tests; syntax checks pass. Event-gated phase/card/target/death/reward animations, engraved card surfaces and portrait lighting added without rule/timing changes. Browser verified ten rows at 320/390/1440px without horizontal overflow; fresh death adds veil once, next target selection leaves resting veil unanimated, and Reduce motion suppresses new-death animation. Browser error log empty. All guide screenshots refreshed. Physical devices, OS-level reduced-motion toggling and deployment remain unverified.

## Clear table and public phase cards — 2026-10-16

Decorative seat icons and candles removed. Seats now show number, name, Alive/Fallen status and full revealed-card names/numbers. Phase roster lists every eligible revealed owner in numerical order; server tracks Waiting/Playing/Played/Unable-to-act, including skipped dead seats and recovered cards. Existing privacy contract remains intact. Phone table uses two columns, 14px gaps and sticky confirmation; hand cards use 24–26px gaps and wrap rather than squeeze. Browser checked ten-seat reveal/targeting/death at 390px (confirmation pinned at y=8 while selecting last seat), compact 320px and desktop 1440px, no horizontal overflow. Revealed card opens exact ability; no candles/avatar DOM remains. Regression suite: 100 tests pass; syntax checks pass. Eight guide screenshots regenerated with four-seat examples. Physical devices and deployment remain unverified.

## Kingmaker result clarity — 2026-10-16

Kingmaker outcomes have a dedicated decree layout, named maker/crowned house, decisive card, rank-override explanation and recipient list. Ordinary rank comparison is hidden for these outcomes. Award rows label/colour each actual house. Unsworn denial has explicit no-house reward wording; final coronation retains individual scores. Award logic unchanged and checked for both houses with fallen allies; suite 101 passing tests, syntax checks pass. In-app browser checked Ashthorn, Stormwing, Unsworn, Kingmaker+final and ordinary dawn at 390px; desktop 1440px checked, no horizontal overflow. Normal dawn screenshot refreshed; screenshots in output/qa/kingmaker-*.jpg. No deployment or physical-device QA.

## Confirmed return to game home — 2026-10-17

Logo opens a stay/leave dialog. Confirmed active-match exit closes the socket, keeps the rejoin secret, and shows Heir home; explicit home mode prevents automatic reconnect, including after reload/online events. Return to your court rejoins the reserved seat. Lobby exit waits for server removal acknowledgment before returning home. Browser verified active cancellation, confirmed home, home reload, same Oracle turn on rejoin, and isolated lobby removal (no Return button). Existing disconnect audit: non-host seat retained, no auto-forfeit/bot; host loss pauses pending return or unanimous connected-player transfer; missing actions/draft/offline-seat next-night gate can stall a permanent departure. State expires on server restart or two hours with nobody online. No permanent-leave rules added.
