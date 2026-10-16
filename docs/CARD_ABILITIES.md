# Exact card-effect map

Audited against the publisher's [core rulebook](https://www.brotherwisegames.com/s/NightoftheNinjaCoreRulebook.pdf) and [FAQ](https://www.brotherwisegames.com/s/NightOftheNinjaFAQ.pdf), with the user's explicit digital-game choices below. “Identity” means **house plus succession rank**. “Courtier” means a player; **Conspirator** is the renamed card category formerly called Courtier/Trickster.

The number changes resolution order only. Each of the six numbered cards in a basic family has exactly the same power.

| Our card | Original / order | Exact permitted effect | Must not happen |
| --- | --- | --- | --- |
| Informant ×6 | Spy, 1–6 | Inspect one other player's identity privately. Living or fallen targets allowed. | No hand-card inspection, public reveal, swap, kill, or seal change. |
| Oracle ×6 | Mystic, 1–6 | Privately inspect one other player's identity and **one random unplayed hand card from that same player**. If their hand is empty, inspect identity only. | No entire-hand inspection, second target, public reveal, or other state change. |
| The Usurper | Shapeshifter, Conspirator 1 | Privately inspect two distinct players' identities (self allowed), then secretly exchange those two or keep them in place. **Both owners lose access either way**, per user decision, so controls cannot reveal the choice. | No hand/seal exchange, public announcement of the chosen outcome, or free reinspection by either owner. Other players retain only information they legitimately already knew. |
| Cryptkeeper | Grave Digger, Conspirator 2 | Privately inspect two random cards from the face-down **draft discard**. Recover exactly one. Leave the other discarded. Play the recovered phase card immediately, or save it for eligible current/future timing. Reactions and Dawn cards wait for their own trigger. | No whole-pile search, undealt-deck access, played-card recovery, recovery of both cards, or firing a saved future card's ability early. |
| The Herald | Troublemaker, Conspirator 3 | Privately inspect one other player's identity. Optionally reveal **that identity** to everybody. Fallen targets allowed. | No automatic reveal, self-reveal, hand inspection, swap, kill or seal change. |
| Soul Broker | Spirit Merchant, Conspirator 4 | Inspect either one other player's identity **or one of their seals**, not both. Then optionally exchange **one owned seal for one of that same player's seals**, preserving both values. The exchanged seal need not be the inspected one. Fallen targets allowed. | No free theft, new seal, changed value, multiple exchanges, public value reveal, or inspection of both identity and seal. Both players must own a seal to exchange. |
| Crown Thief | Thief, Conspirator 5 | Reveal own identity. Optionally take **one existing face-down seal** from another player with **more seals by count**, regardless of their total Prestige. Fallen targets allowed. | No theft from an equal/lower seal count, seal creation/value change, private identity inspection, or extra reward. If no eligible holder exists, only self-reveal occurs. |
| High Justiciar | Judge, Conspirator 6 | Reveal own identity and kill one living player. Neither Mirror Warden nor Royal Martyr responds. | No target identity inspection/reveal, reaction prompt, reflected death, or Martyr seal. |
| Cutthroat ×6 | Blind Assassin, 1–6 | Kill one living player, subject to the two legal reactions below. | No private identity inspection, automatic identity reveal on death, seal change, or second victim. |
| King's Blade ×6 | Shinobi, 1–6 | Inspect one living player's identity privately. Then explicitly choose **kill or spare** that same player. A kill may trigger a legal reaction. | No automatic killing after inspection, other target, hand inspection, or reaction on a spared target. Self-inspection is allowed after an Usurper visit. |
| Mirror Warden | Mirror Monk, reaction | Only when a Cutthroat/King's Blade commits to killing its owner: optionally consume this card and replace the incoming kill with the attacker's death. | No seal, public identity reveal, later immunity, or response to Justiciar/inspection alone. No chained reaction to the reflected death. Killing yourself still means you die; this card is not unconditional immunity. |
| Royal Martyr | Martyr, reaction | Only when a Cutthroat/King's Blade commits to killing its owner: optionally consume it, gain **one** random 2–4 Prestige seal, and still die. | No survival, reflected kill, second seal, Justiciar trigger, or immediate coronation. |
| The Kingmaker | Mastermind, Dawn | If alive at dawn, its current house wins this night, overriding surviving ranks. Normal faction rewards follow. If Unsworn, deny both houses their faction rewards; the living Unsworn still gets its normal survival seal. | No effect while dead, immediate match victory, extra personal seal on top of normal qualification, identity change, or opponent death. |

Cutthroat, King's Blade and Justiciar use “a player” and allow self-targeting; Informant, Oracle, Herald and Soul Broker require somebody else. Each incoming attack offers one legal reaction or Skip. A consumed card cannot react again. Every power is single-use for that night.

## Automatic events are separate from card powers

- Phase cards flip together and resolve in printed order, per the user's digital rules. Ordinary card resolution may advance the phase, but **that is not an extra ability**.
- Death never newly exposes an identity. An identity already publicly exposed remains known until a legitimate identity change.
- At dawn, reveal all identities. Compare living house ranks lexicographically, with 1 highest. Complete ties reward all survivors. All members of the winning house get one seal, including fallen members; a living Unsworn also receives one. Never double-award the Unsworn through two qualifications.
- Each seal has an immutable private value of 2–4; everybody sees seal count. Transfers move the original token. No action changes existing values.
- Only after all dawn rewards, the highest total of 10+ wins; equal highest totals crown joint heirs. Otherwise the host begins another night.

## Evidence

`tests/card-contract.test.js` isolates the next action so dawn cannot add rewards during the assertion. Its 57 checks cover all numbered variants, every optional branch, private projections, token conservation, forbidden effects, both reactions, and living/fallen/Unsworn Kingmaker cases. Separate integration tests cover real server authorization and room lifecycle. The audit confirmed and fixed the Usurper's swap-only announcement and asymmetric owner access; it does not claim unspecified observed bugs had any particular cause.
