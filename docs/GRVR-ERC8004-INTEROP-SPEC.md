# GRVR ↔ ERC-8004 Interop — Grounded Mirror Spec

**Status:** normative build spec for Groover implementing agents.
**Thesis:** ERC-8004 is the market's discovery layer (170k+ agents, 19 chains) but its
identity records are empirically ungrounded (June 2026 study: 85–97% placeholders,
Sybil-gamed reputation). GRVR mints carry proofs (DID, DNA, inspect attestation,
governance citation). This spec mirrors every GRVR mint into ERC-8004 so Groover
agents become **the grounded subset** of the 8004 population — complementary, not
competitive. No GRVR contract changes. No 8004 contract changes.

**Phase scope:** identity mirror only (register + registration file + self-binding
update). Validation records deferred — the Validation Registry is **mainnet-pending**
(testnets only) per the 8004 working group. Reputation posting deferred (requires
per-interaction client signatures; no standing to automate). Both are §10, with
re-entry criteria.

---

## 1. Verified base facts (Base mainnet 8453, checked live)

| Item | Value | Verified how |
|---|---|---|
| 8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `cast code` non-empty; `name()` → `AgentIdentity`; vanity CREATE2, same on all mainnets |
| 8004 ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | `cast code` non-empty |
| 8004 ValidationRegistry | **not deployed on mainnet** | working-group table lists testnets only; no mainnet address published |
| GRVR token | `0x0abcd80C929Ff2f6c308958B112b7925801750D7` | chrono-warp-drive handoff; live-verified 2026-09-10 via cast (`totalSupply == 0` then) |
| GRVR minter (Railway) | `0x77E7A48609e9c8A77C7639172af9EEA0e5E80DF7` | holds `MINTER_ROLE` on GRVR (verified on-chain 2026-09-10 via cast) |
| 8004 `register` | `register(string agentURI)` → `uint256 agentId` (plus `register()` and `register(string, MetadataEntry[])` overloads); mints ERC-721 to `msg.sender`; emits `Registered(agentId, agentURI, owner)`; `agentWallet` defaults to owner. **Measured:** `eth_call` simulation on Base returns next agentId without revert (observed `85540`; ~85k agents registered) | canonical EIP + reference contracts + live simulation |
| 8004 `setAgentURI` | `setAgentURI(agentId, newURI)` → emits `URIUpdated(agentId, newURI, updatedBy)`; authorized to owner **or** approved operators (`isApprovedForAll`/`getApproved`) — safety holds while the minter grants no approvals (never grant any) | canonical EIP + reference source |
| Global agent handle | `agentRegistry = eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, `agentId` = minted id | EIP agent identity format |
| Registration file | JSON, `type: https://eips.ethereum.org/EIPS/eip-8004#registration-v1`, **required** `name/description/image/services[]`; **optional** `registrations[]`, `supportedTrust[]` (EIP-correct optionality); `agentURI` MAY be `https://` | canonical EIP (services incl. custom `DID` entry `{name:"DID", endpoint:"did:…", version:"v1"}`) |
| Groover mint flow (current) | `mintGrvrIdentity` in `packages/identity/src/grvr-mint.ts`: prepare → `writeContract(mint)` → receipt → `tokenIdFromMintReceipt`; returns `did/dna/pack/variant/identityKey/contract/to/txHash/tokenId` (**drops `dynamoCitation`** — callers retain the input); no govern gate and no image-warm step exist in the path today (both are proposed: citation policy + compositor-spec warm check) | origin/main code |

## 2. Mirror design (normative)

For every GRVR mint (Sepolia proving, mainnet operating), `mint_suit` performs the
mirror **after** the image warm check succeeds. Mirror failure never fails or
reverts the GRVR mint (mint is paid and final; mirror retries out-of-band, §6).

### 2.1 Sequence

1. GRVR mint succeeds → `(grvrTokenId, did, dna, pack, variant, identityKey)` from the
   mint result **plus the caller-retained `dynamoCitation` input** (the mint result
   drops it).
2. Build registration file **v1** (§2.2 with `"active": false` and NO `registrations`
   array — the binding is unknowable yet) → write immutable file
   `…/identity/registration/grvr-<grvrTokenId>-v1.json` on the Railway host
   (served per §6 route addition).
3. `register("…/grvr-<grvrTokenId>-v1.json")` on the §3 registry for the active chain,
   signed by the same Railway minter key (`GRVR_PRIVATE_KEY`) → `agentId` from the
   `Registered` event (parse receipt logs; same pattern as existing
   `tokenIdFromMintReceipt`). Owner of the 8004 NFT = Railway minter EOA (same EOA
   that holds GRVR `MINTER_ROLE`; consistent custody, no new key).
4. Build registration file **v2** = v1 with `"active": true` + `registrations:
   [{agentId, agentRegistry}]` → write immutable file `…-v2.json`.
5. `setAgentURI(agentId, "…-v2.json")` → emits `URIUpdated`. Indexers listen for this
   event to refetch (design intent of the protocol; refetch itself is indexer policy,
   not consensus — hence versioned immutable files, never in-place mutation).
6. Record `(grvrContract, grvrTokenId, agentId, agentRegistry, txHashes)` in a **new**
   Groover registry index for audit (no such store exists in the mint path today;
   §6 adds it — file or table alongside the mint log, keyed by `identityKey`).

Two transactions per mirror (`register` + `setAgentURI`), both Base-cheap.
Versioned immutable files (never rewrite a served URL).

### 2.2 Registration file template (exact; v1 = §2.2 minus `registrations`, `"active": false`)

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "groover-<did-short>",
  "description": "Groover identity mark for <did>. Pack <pack>, variant <variant>. Grounded issuance: DNA + inspect attestation + Dynamo governance citation, mirrored from GRVR token <grvrTokenId>.",
  "image": "https://registry-production-e2c4.up.railway.app/identity/token-image/<grvrTokenId>",
  "services": [
    { "name": "DID", "endpoint": "<did>", "version": "v1" },
    { "name": "GRVR", "endpoint": "eip155:8453:0x0abcd80C929Ff2f6c308958B112b7925801750D7/<grvrTokenId>", "version": "v1" }
  ],
  "x402Support": false,
  "active": true,
  "registrations": [{ "agentId": "<8004-agentId>", "agentRegistry": "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" }],
  "supportedTrust": ["groover-provenance"],
  "groover": {
    "did": "<did>",
    "dna": "<0x-64hex>",
    "pack": "<pack>",
    "variant": "<0-15>",
    "identityKey": "<0x-64hex>",
    "grvrContract": "0x0abcd80C929Ff2f6c308958B112b7925801750D7",
    "grvrTokenId": "<tokenId>",
    "dynamoCitation": "<0x-64hex-or-none>",
    "grvrChainId": 8453
  }
}
```

Rules: `name` = `groover-` + first 12 hex of the DID suffix (unique, non-generic per
8004 best practices — never `Agent #N`); `image` reuses the token-image URL (single
visual identity across both systems); `did-short`/URLs XML/JSON-safe by construction
(DID charset is hex+colon); v1 omits `registrations` (unknown until step 3), v2 adds it.
All chain-specific values (`GRVR` endpoint prefix, `agentRegistry`, `grvrChainId`,
`grvrContract`) follow the ACTIVE chain — template shows mainnet
(`eip155:8453`, `0x0abcd80C…`); Sepolia proving uses `eip155:84532`, the §3 Sepolia
registry/contract.
`supportedTrust: ["groover-provenance"]` is declared and defined here: trust grounded
in on-chain GRVR proofs (DNA, citation), not in 8004 feedback — honest advertising,
indexers that don't recognize the string ignore it harmlessly.

### 2.3 Costs and custody

- `register` measured **134,840 gas** (`cast estimate` + `eth_call` simulation on Base,
  2026-09-10); `setAgentURI` is one SSTORE + event (~60–100k gas est.). Total mirror
  ≈ 200–250k gas — less than the GRVR mint itself. Paid by the Railway minter key
  from its existing balance. No new key, no new funding line.
- 8004 NFT owner = minter EOA. No `setAgentWallet` (needs EIP-712 proofs; skipped —
  default owner-as-wallet is correct for a minter-owned identity).
- No protocol fees in 8004 (both calls nonpayable, no fee logic in reference source;
  gas only).

## 3. Env (normative, namespaced, additive only)

```
MIRROR_8004_ENABLED=true|false        # default false until first mirrored mint passes §7
MIRROR_8004_IDENTITY_REGISTRY=        # empty = resolve by chain: 8453 → 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432, 84532 → 0x8004A818BFB912233c491871b3d84c89A494BD9e (code verified on both; testnets do NOT share the mainnet vanity address)
MIRROR_8004_FILE_BASE=https://registry-production-e2c4.up.railway.app/identity/registration
```

No changes to existing `GRVR_*` vars. Mirror reads the same `GRVR_PRIVATE_KEY`
(never introduce a second signing key for this flow).

## 4. Failure modes (normative)

- `register` reverts / RPC down → log structured `mirror-8004-fail` with step + tx
  context, retry out-of-band (bounded queue, backoff, alert after 3); GRVR mint stands.
- Registration file host write fails → same path (mirror is post-mint, never blocks mint).
- `Registered` event missing from receipt → treat as failure (do not guess agentId).
- `setAgentURI` callable by owner or approved operators — the minter key MUST never
  grant approvals (`approve`/`setApprovalForAll` stay unused); audit for them.
- Chain reorg around mirror txs → re-derive agentId from receipt logs on retry (idempotent:
  re-running mirror for a token first reads `tokenURI(agentId)` for any existing binding;
  a blind `register` retry mints a **new** id, so the check is load-bearing, not optional).

## 5. Security notes

- No new trust assumptions: the minter key could already mint arbitrary GRVR tokens;
  mirror adds no capability, only public bindings. A rogue minter is visible in both
  registries equally.
- Registration files are immutable once referenced; v1→v2 rotation only via
  `setAgentURI` event (indexers refetch on event, never poll-mutate).
- No secrets in files (DID/DNA/token data are all public on-chain already).
- `active: true` set only after the v2 update confirms (file for an unbound agent
  must not claim active status... v1 carries `"active": false`, v2 flips to `true`).

## 6. Files (normative, all Groover-side; no contract changes)

| File | Action |
|---|---|
| `packages/identity/src/mirror-8004.ts` | **New** — file builders (v1/v2), `registerAgent`, `setAgentUriSelf`, `mirrorGrvrMint` orchestrator (§2.1), env readers (§3) |
| `packages/identity/src/mirror-8004.test.ts` | **New** — §7 checks |
| `packages/identity/src/grvr-mint.ts` | Modify: call `mirrorGrvrMint` after image warm check iff `MIRROR_8004_ENABLED`; never throw into mint path |
| `packages/marketplace/src/mcp-server.ts` | Modify: add `GET /identity/registration/<file>` static route serving the mirror dir (`application/json`, immutable, CORS `*`; reject `..`/non-`grvr-*-v[12].json` names with 400) — without this the §2 file URLs are unserved |
| `docs/GRVR-MINT.md` | Update: mirror section (flow, env, file URLs, audit query) |

## 7. Acceptance (all must pass)

1. Simulated `register(string)` via `eth_call` against Base `0x8004A169…` returns an
   agentId without revert (interface live, calldata correct — measured `85540`).
2. Sample v1/v2 files validate: **required** `type/name/description/image/services`
   present (EIP-required set); `services` contains `DID` + `GRVR` entries; v2
   `registrations[0]` parses as `{agentId: <int>, agentRegistry:
   "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"}` (optional per EIP,
   required by this mirror); `groover` block fields match the GRVR token data
   byte-for-byte; v1 has `"active": false` and no `registrations`, v2 flips both.
3. Unit tests green: file builders deterministic (same input → identical JSON),
   `tokenIdFromMintReceipt`-style parser extracts agentId from a fabricated
   `Registered` receipt, idempotency check short-circuits when bound.
4. E2E on **Sepolia first**: full `mint_suit` with `MIRROR_8004_ENABLED=true` against
   GRVR Sepolia + 8004 **Base-Sepolia `0x8004A818…`** (different address than mainnet —
   code presence verified) → real agentId; registration file serves v2; `URIUpdated`
   observed.
5. `npx vitest run` green; no `*.sol`/contract changes in diff.
6. Docs updated (`GRVR-MINT.md` mirror section); handoff note in chrono-warp-drive
   (one line: 8004 agentId per GRVR token) — follow-up commit, not this PR.

## 8. Out of scope (implementing agent will be wrong to do these)

- Reputation posting (`giveFeedback` needs per-interaction client signatures — no
  standing to automate; revisit when Groover agents transact as clients).
- Validation records (registry mainnet-pending; re-enter when `ValidationRegistry`
  deploys on Base mainnet — then: validation request citing `identityKey` + DNA,
  response carrying inspect/dynamo evidence).
- `setAgentWallet` proofs, x402 integration, ENS names, cross-chain mirrors,
  changing the GRVR mint flow beyond the post-warm mirror call and the §10 citation
  gate, new signing keys.

## 9. Why this wins (for the skeptic)

8004's own empirical literature (arXiv:2606.26028, June 2026 cross-chain study of
170k+ agents; registry census via the EIP address table and QuickNode explorer) says
its records are ungrounded claims. Every Groover mirror entry carries: content hash
of the agent's verified build output (DNA), the inspection verdict that cleared it,
the governance decision that authorized it (citation), and a visual identity derived
from the same DNA — all resolvable from the registration file, all anchored on-chain.
That is the grounded subset, and it is the only subset whose contents survive the
study's critique.

## 10. Parity: mutual anchoring with Dynamo governance (directional, policy-level)

The mirror makes Groover identity legible to the market. Parity makes it
mutually anchored with Dynamo: temporal memory authorizes identity memory, and
every identity mark cites its temporal receipt.

**The closed loop (to be implemented in `mint_suit`, no contract changes):**

1. Groover identifies the agent → DID + DNA via pack adapter (exists).
2. For `0xray-suit`: mill inspect attestation (exists — Groover-side fitness proof).
3. Dynamo `govern_with_solar` approval → decision recorded as a container ID on
   `TemporalContainerRegistry` (new step: Groover invokes the Dynamo MCP itself and
   REQUIRES a PASS — the returned container ID becomes `dynamoCitation`; missing
   response or non-PASS means no mainnet mint. This is deliberately stricter than
   today's inspect path, which trusts caller-provided `inspect.ok` + DNA match
   without re-running inspection; the citation must never become another
   honor-system field).
4. Mint with `dynamoCitation = bytes32(containerId)` (field exists on-chain,
   currently always zero; no contract change needed).
5. Mirror to 8004 per §§2–3, carrying the citation in the `groover` block.
6. Verification runs both ways: token → citation → container → decision;
   container → (registry index, §2.1 step 6) → token.

**Why policy-level, not cryptographic:** the GRVR contract deliberately keeps
`dynamoCitation` optional with no registry lookup (decoupling the contracts was an
explicit spec decision). Enforcement therefore lives in `mint_suit` code + audit:
citation-less mainnet mints are publicly visible and reviewable. This is also what
distinguishes approval-gating from the banned auto-mint pattern — governance
attests, Groover still signs; neither side mints alone.

**Transponder framing (shared vocabulary, decided):** a transponder is any canonical
fixed point that answers interrogation. `T_c` is the temporal transponder (memory
of the resonance field); the GRVR mark is the identity transponder (memory of the
agent). One line per repo states this; the shared word is architecture, not collision.

**Liveness coupling (accepted risk):** governed mints depend on Dynamo MCP uptime.
Posture: queue, never bypass — a mint that cannot get its citation waits; it does
not mint citation-less on mainnet. The queue is durable, not in-process:
append-only `pending-citations.jsonl` next to the §2.1-step-6 index file, reaped on
boot with backoff (in-process state dies with Railway deploys, which already drop
registered DIDs — a memory-only queue would silently drop mints). Sepolia proving
may exercise the degraded path explicitly and label it as such in the file
(`"degraded": true`, never on mainnet).

## 11. Long-term view (staged; this PR is stage 1)

- **Stage 1 — Identity mirror (this spec):** every GRVR mint mirrored to 8004 with
  proofs in the file. Success = Groover agents resolvable in every 8004 indexer
  with strictly more evidence than the surrounding population.
- **Stage 2 — Validation mirror:** when `ValidationRegistry` deploys on Base mainnet,
  post validation requests citing `identityKey` + DNA, with responses carrying
  inspect/dynamo evidence. Re-entry criterion: canonical address published by the
  8004 working group + `cast code` verified. Until then, the registration file IS
  the validation surface — do not fake it with reputation posts.
- **Stage 3 — Earned reputation:** when Groover agents transact as clients (x402 or
  otherwise), post `giveFeedback` with real interaction proofs. Never synthesize
  feedback; the study's core finding is that ungrounded feedback is worthless, and
  manufacturing it would collapse the distinction this whole design exists to create.
- **Structural (ordered by leverage):**
  1. **Dogfood the population** — every mill agent gets a mainnet GRVR with real
     inspect citations. A grounded subset of zero is a null set.
  2. **Agent-held keys** — custody of the Ed25519 key behind the DID moves to the
     agent (key rotation, `setAgentWallet` proofs). No DID-scheme change is needed:
     `did:groover:` already derives via `didFromEd25519PublicKey`; the minter EOA
     signs GRVR/`register`, it never mints the DID string. The work is wallet
     custody + rotation, and it unlocks `setAgentWallet` proofs.
  3. **Revocation story** — 8004-side only: flip `active: false` and propagate via
     `setAgentURI`, plus an optional registry denylist. No on-chain GRVR flag: the
     contract is frozen, and a flag would be a new contract version — called out
     here as a freeze exception if ever pursued, not a silent option.
  4. **Decentralize issuance** — replace the hot-wallet minter with governance-vote
     or TEE-attested issuance; the audit trail built in stages 1–3 is what makes
     the decentralization claim checkable.
  5. **Cross-chain mirrors** — same vanity 8004 registries exist per chain; mirror
     where agents operate, keeping GRVR Base canonical and cross-referencing via
     the `registrations[]` array (designed for exactly this).
- **What does not change:** GRVR contract (frozen), URL shapes (frozen by on-chain
  metadata), the minter-signs/governance-attests separation, single-signing-key
  custody until stage 4.
