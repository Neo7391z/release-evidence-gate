# Browser verification, 2026-11-16

Public app: https://release-evidence-gate-neo7391z.compassionateibex.chatgpt.site/

Observed using the published application UI:
- Live finalized ledger showed v1 DOCUMENTED and v2 BLOCKED, with criterion 2 regression and exact evidence quotes.
- Blank evidence was rejected before any transaction; the run button remained usable.
- A new isolated write run disabled the run button, preventing a duplicate click.
- Refreshing the public ledger while the isolated run was pending did not mix addresses or results.
- Expanding the on-chain record revealed the complete expected JSON.
- Isolated deployment finalized and the app proceeded to its audit transaction.

Isolated contract: 0x8df4131c2AD9B1Dc9b4adE559203bC648045Ee06
Deployment transaction: 0xed9f0b339a37e29bf61d10ef9c8fcab4f8c17d128152ef7d64ae6e5238c8037f
Audit transaction: 0xbef164794bc116f56a1ec20a2c4bed51a90f52df2e911c541f754d9e47e41205

Audit final result observed in UI: FINALIZED, BLOCKED. Criterion 1 MET and criterion 2 NOT_MET, with exact supporting quotes. The button re-enabled after completion. This confirms the published browser app performed both transactions and rendered the final returned record.
Mobile viewport and simulated network-failure UI tests were not performed in this run.
