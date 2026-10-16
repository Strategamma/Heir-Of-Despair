# Goal / scope
Host resolution of disconnected active seats: abandon or mark fallen, exclude next night; minimum four retained players.

# Approach
Retain current-night seats for drafting/scoring. Skip forfeited choices, reject rejoin, filter before next deal. Host-only commands and confirmed responsive controls; explicit abandoned state.

# Risks
Pending reactions/Usurper choices, fixed draft passes, host transfer, hidden information and minimum player count.

# Verification
Engine regression tests, WebSocket authorization/lifecycle tests, syntax and complete suite; browser check host controls and confirmation.

# Outcome
Implemented. 108 tests and syntax checks pass. Phone browser verified confirmation, four-player restriction and abandoned end screen; no browser errors. Local preview restarted. No deployment or physical-device LAN test.
