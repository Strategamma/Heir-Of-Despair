# Heir of Despair

Social deduction PWA for Decadenceinc.com; 4–10 players. Stack: native browser ES modules/DOM/CSS, Node.js, `ws`, authoritative server. Render deployment; separate local-server LAN mode. The hosted public PWA requires Internet. LAN means connecting browsers directly to a PC's private-IP HTTP origin; install from public HTTPS, not LAN HTTP. Browser LAN discovery is not promised.

Theme: royal funeral → dawn → coronation; gold branding, charcoal/ivory/garnet/teal. No throne backdrops. House Ashthorn (rose/garnet), House Stormwing (falcon/teal); odd counts add The Unsworn, neutral survival reward. Readable text, portrait first; settings/install are icons; header uses the generated wordmark. Seats use names and Alive/Fallen labels; no decorative avatars or candles.

Night of the Ninja mechanics with original names/art. Draft 3, keep 1, pass 2 left in fixed seating order, keep 1, discard 1. Categories: Informant, Oracle, Conspirator, Cutthroat, King's Blade; reaction/end-night powers have special timing. Phase cards reveal together, actions resolve by printed number; auto-advance after abilities. Reaction prompt only if legal. Recovered discard: inspect two, choose one, play now or save.

Each night identities redeal; Royal Seal tokens persist per player through the match. Each seal has fixed value 2–4 Prestige. Opponents see token count only. Highest surviving house rank wins (1 highest), compare subsequent ranks on ties. All winning-house members, dead included, receive one seal; living Unsworn also receives one. Resolve all rewards before checking 10+; highest qualifying total wins, equal highest totals are joint heirs. Host starts each subsequent night.

`#arcadeName` is editable prefill only; opaque seat secrets authorize rejoin/actions. Projections hide other hands/token values/findings. Logo confirms exit to game home. Lobby seats are removed; active seats stay reserved with explicit Return and reload-safe home mode. Host disconnect pauses until return/consensual transfer. Host may abandon or forfeit offline seats if ≥4 remain. Forfeits skip pending choices, stay fallen with normal rewards this night, cannot rejoin, and leave before next deal. Draft passes retain current seating.

Same Wi-Fi creates a coded court immediately. Local servers automatically select a private invite address; hosted Same Wi-Fi uses the existing Render service and requires Internet. No address form or LAN/SSID scanning. Usurper locks both inspected identities for swap and keep, with identical public messages/owner controls. Exact effect and forbidden-side-effect map: docs/CARD_ABILITIES.md.

Guide: eight accessible tabs with screenshots, via Settings. Loopback fixtures: scripts/guide-fixtures.js.

Court clarity: confirmed draft heading “Prepare for the night.” Open allegiance uses house colour; kept cards remain visible during draft. Full phase order, active ability and a public phase roster show card icons, owners, printed numbers and Waiting/Playing/Played/Unable-to-act status. Roomier phone tables use two columns and sticky confirmation. Rooms use server-controlled 2.8s phase calls and 2.4s resolution pauses. Public activity reveals actors, cards and targets, never findings or hidden seal values. Complete rank ties reward survivors only.

Coronation alone exposes each player’s aggregate Prestige alongside seal count, sorted by score; individual token values remain private. Motion respects reduced motion.

Kingmaker results use a dedicated decree: maker, crowned house or Unsworn denial, and seal recipients. Hide rank comparison; award rows label actual houses.
