# Release Evidence Gate

A non-monetary GenLayer research application for reviewing whether a sequence of release evidence snapshots documents the same immutable acceptance criteria. It does not deploy software, certify security, prove test execution or authenticate source URLs.

## Trust problem

A release announcement can quietly stop satisfying an earlier promise. Reviewers need a fixed checklist, evidence anchors, and an immutable version trail instead of one maintainer's opaque LLM score. The ledger binds 1–4 acceptance criteria at deployment, requires an exact parent and revision, audits each snapshot using independent validator model judgments, and records which previously MET criteria regressed. The maintainer cannot replace historical evidence or weaken criteria.

## What GenLayer does

`contracts/release_gate.py` runs semantic documentary-support evaluation via `gl.vm.run_nondet_unsafe`. Each validator independently evaluates the complete criteria/evidence envelope; matching output shape alone is insufficient. Exact quote anchoring and strict schema checks precede acceptance. Consensus compares the verdict vector, permitting equivalent evidence quotes. Deterministic aggregation gives BLOCKED if any criterion is NOT_MET, REVIEW_REQUIRED for remaining uncertainty, or DOCUMENTED only if all are MET.

No chain operation triggers a deployment or payment. DOCUMENTED is deliberately not called READY or SAFE.

## Run

Node 24+, Python 3.12+. Dependencies are pinned in package.json and requirements-test.txt.

```
npm install
python -m venv .venv
.venv/bin/pip install -r requirements-test.txt
.venv/bin/python -m pytest -q
node scripts/demo.mjs --authorized-studionet-only
python3 -m http.server 4184 --directory web
```

The CLI uses a new disposable signer under gitignored `.local/`, never a real wallet, and refuses nonzero gas prices or the wrong chain ID. It persists transaction intents before submission, recovers uncertain submissions by hash rather than resubmitting, waits for finality, validates 5-validator receipts, checks deployed source equality, and saves projected public receipts under `evidence/`. Demo evidence is explicitly synthetic at example.org, not a claim about real software.

The SDK runner may need its official release artifact cached. Tests use genlayer-test's direct VM fixtures with mocked model output; they are state/validator-path tests, not real consensus tests. The CLI receipts are separate integration evidence.

## Web application

Open the static `web/` site. It reads final ledger state directly from Hosted Studionet through genlayer-js, displays all criteria, statuses, exact quotations, hashes, parent releases and regression indices. It does not fall back to fabricated cached state when a read fails.

The separate **Create free demo & audit evidence** control performs real transactions: it creates an ephemeral in-memory signer and a fresh isolated contract, submits the editable synthetic evidence, polls each transaction to finality, and shows the returned on-chain record. The key is never sent to an external service or persisted. Refreshing loses control of that disposable demo. Do not submit personal, proprietary or sensitive evidence to this public simulator. A pending transaction can finish after timeout; the UI never automatically resends it.

Source for the viewer is `web/app.js`. Run `npm run build` to generate the browser bundle `web/bundle.js` (not committed). Copy the contract to `web/release_gate.py` after editing it.

## Verification

Unit tests cover deterministic statuses, parent/revision locking, immutable releases, ownership, duplicate evidence rejection, malformed indexes and quotations, independent validator dissent, and regression calculation. `evidence/unit-tests.txt` records the actual run. `evidence/deployment.json` is generated only after successful live scenarios.

Expected demo: v1 documents both criteria; v2 retains Unicode export but explicitly says cancellation downloads a file, so it is BLOCKED and reports criterion 2 as a regression.

## Limitations and threat model

* A maintainer chooses snapshots and can omit inconvenient evidence. Consensus cannot fix dishonest input.
* URLs are provenance labels only. This version does not fetch or authenticate them. Hashes attest immutable bytes, not truth. For real-world conclusions, independently obtain authoritative, version-pinned inputs first.
* Prompt injection is treated as untrusted data, but model defenses are not a guarantee. Model disagreement or errors can prevent finalization.
* Hosted Studionet is a simulator, not proof of production decentralization or mainnet behavior.
* Ledger capacity is 20 releases, four criteria, and four 2,000-character documents per audit. New criteria require a new ledger.
* Only the owner can audit; there is no key recovery or ownership transfer. The web demo is intentionally disposable.
* No claim of universal model accuracy; synthetic scenarios establish only the observed behavior.

MIT license. Transport receipt verification is adapted from this author's Semantic Proposal Registry project; the contract state machine and application are a distinct release-evidence use case.

### Browser verification limit

The CLI integration cases and unit tests above passed. The initial browser UI attempt could not connect to the local preview server, so browser rendering, mobile layout and the UI write button remain unverified until an accessible preview is tested. Do not interpret the CLI result as a UI pass.
