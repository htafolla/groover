# Groover Identity mint (GRVR)

Contract is on chrono-warp-drive. Groover is the minter. Pack DNA is an **adapter**: a new schema is a Groover PR, not a new contract.

## Adapter

`packages/identity/src/packs/`:

1. Add `<id>.ts` implementing `PackAdapter` (`pack`, `description`, `resolveDna`).
2. `registerPackAdapter(...)` in `packs/index.ts`.

MCP `mint_suit` then accepts that `pack` id. Chain stores `pack` + `bytes32 dna` + `level`.

Builtin:

| pack | DNA |
|------|-----|
| `groover-identity` | keccak256(did) |
| `0xray-suit` | keccak256(canonical mill inventory without `mintedAt`/`dna`); requires `inspect.ok` |

## Base mainnet (live) — v2 + Level

- `0x7b184bf7B7054A7328a1D7851465c6001Bb2AFb3`
- chain 8453 · https://basescan.org/address/0x7b184bf7B7054A7328a1D7851465c6001Bb2AFb3
- deploy: `0x838645d2790a8f02385b07c296d17e72f00874037b8387f9ef5eeebf2bc66965`
- MINTER_ROLE: `0x77E7A48609e9c8A77C7639172af9EEA0e5E80DF7` (Railway `GRVR_PRIVATE_KEY`)
- Admin: `0xd45CcF98D6db5A36E7CdD10ffae0b685BF27CE43`
- `MAX_LEVEL` = 5 · mint is 7 args (`…, dynamoCitation, level`)
- ABI: `packages/identity/abi/GrooverIdentityToken.json`
- v1 `0x0abcd80C929Ff2f6c308958B112b7925801750D7` is superseded. Do not mint there.

## Image (Railway SVG, not Base pixels)

`tokenURI` is tiny on-chain JSON. `image` is frozen `IMAGE_BASE + tokenId`:

`https://registry-production-e2c4.up.railway.app/identity/token-image/{tokenId}`

Pixels are **not** on Base. `IMAGE_BASE` is frozen. Recipe on-chain: `did`, `pack`, `variant`, `dna`, `dynamoCitation`, `level`.

**Level** (OpenSea trait `Level`): 0 Unknown, 1 Dissonant, 2 Unstable, 3 Resonant, 4 Celestial. From Dynamo 7D at mint (`fullBox7D` or explicit `level`). ≥0.95 Celestial, ≥0.78 Resonant, ≥0.50 Unstable, scored else Dissonant. **No Dynamo / no 7D → Unknown** (not Dissonant — that is a scored miss). Variant is still visor (`hash(did,dna)%16`), not Level.

Live v2 is `0x7b184bf7…`. Railway must set `GRVR_CONTRACT` to that address or env still wins with v1.

Railway `GET /identity/token-image/{tokenId}` reads `getTokenData` and returns deterministic SVG (`composeIdentitySvg`). Unique visor meshes (4 hats) × unique chassis (2 packs) × 4 colorway palettes. Banner follows hat. MILL+INSPECT cores only on `0xray-suit`. Not Imagine. Not 1024 PNG plates. Not `sharp`. Tiny SVG (<12KB), sharp at any scale.

Job plates, suit state, and mill job line stay off-chain (not in `TokenView`). Spec: `docs/GRVR-IMAGE-COMPOSITOR-SPEC.md`.

## Transponders (Groover + Dynamo)

Read from **chrono-warp-drive code**, not the Codex gloss. Repo path is `chrono-warp-drive` (not "chronos").

A transponder is a fixed point that answers interrogation. Codex name in code: **Temporal Photonic Transpondent Transporter** (`tPTT`). Codex writes `T_c = ∫ A_m dt` (memory of the field). Production does **not** integrate: `TemporalCalculatorV4.integrateA_m()` is the mean of spectrum intensities; the solar hammer maps `T_c` from proposal word-count / character diversity vs NOAA activity (`deriveProposalCodexParams` / `deriveSolarCodexParams`). tPTT = `T_c × (P_s / E_t) × PHI × (C / Δt)`. Shared **word**, two collections, two contracts. Do **not** pour mill exo / visor / DNA into VRTX.

| Transponder | Answers | On-chain today |
|---|---|---|
| **VRTX** (`VortexTokenV41`, "Dynamo Vortex") | Did the sun + field accept this *decision*? | Verdict, 7D Composite, TMO, Fusion, Moral Tension, Source, Wave/Phase/Calibrated/Neural axes, Gematria/Virtue/Moral Safety/Intent, Minted, optional Proposal. Image: `https://mcp-production-80e2.up.railway.app/vortex/token-image/{id}`. **No isotope trait.** |
| **GRVR** (`GrooverIdentityToken`) | Who is wearing this mill DNA, locked at this instant? | DID, Pack, Variant, DNA, Dynamo citation, **Level**, Minted. Image: Groover `IMAGE_BASE + tokenId`. Level is the rarity of that lock. No Dynamo → Unknown. |
| **TemporalContainerRegistry** | The receipt VRTX is minted from | Solar snapshot (activity, xray, kp, proton, magnetometer, solarTdf) + 7D profile + TMO. **No isotope field on the container either.** |

`tokenByContainerId` / `getContainerData` exist on VRTX. GRVR `dynamoCitation` is optional and does **not** `require` a registry lookup (decoupling was deliberate).

### What forcing Dynamo on `mint_suit` actually means

Groover invokes Dynamo `govern_with_solar` itself and **requires `recommendation === 'PASS'`**. Groover still signs GRVR. This is not Dynamo minting identity.

The PASS that matters is the **hammer** verdict in `dynamoSolarGovernance.enhanceGovernanceDecision`, not the 7D box verdict:

1. NOAA fetch → activity `quiet | moderate | active | storm`.
2. Proposal and sun each become a `TemporalBlurrnSignal` (TDF fingerprints). Kuramoto N=3 coupling. Wave box. Gematria. TMO (separate axis, not mixed into 7D).
3. `structuralResonance` vs **adaptive thresholds** (code, not the MCP docs table):

| NOAA | strong PASS | good PASS | weak (REVISION) |
|---|---|---|---|
| quiet | ≥ 0.86 | ≥ 0.78 | ≥ 0.64 |
| moderate / active | ≥ 0.88 | ≥ 0.78 | ≥ 0.62 |
| storm | ≥ 0.92 | ≥ 0.84 | ≥ 0.70 |

4. **Storm override (this is the gravity):** if activity is `storm`, any hammer `PASS` is forced to `NEEDS_REVISION` and confidence drops 0.12. The sun can refuse a mint even at high resonance. Quiet sun makes PASS easier.
5. 7D `fullBox7DVerdict` uses a *different* threshold table in `wavePropagation.ts` (quiet strong 0.82, storm strong 0.88) and has **no** storm PASS→REVISION override. A 7D PASS during a storm is not a mint gate. Gate = hammer `recommendation`.

**Citation needs `persistToChain: true`.** Without persist there is a verdict and no `containerId`. With persist:

- REJECT is refused (`cannot persist to chain`).
- NEEDS_REVISION *can* persist a container — Groover still must not mint GRVR unless PASS.
- Persist then **fire-and-forgets `autoMintVortex`** (VRTX to treasury). Groover cannot turn that off from this side. That is a *decision* NFT for the same container, not the exo. Accept the pairing or wait for a Dynamo persist-without-mint flag. Do not copy mill DNA into that VRTX.

**Liveness (accepted):** missing Dynamo MCP → no mainnet mint (queue `pending-citations.jsonl`, never bypass). Caller blocks; journal is WAL.

**The silent-sun hole (do not treat as approval):**

- `getSolarContextForGovernance` catch → activity `moderate`, "Unable to fetch solar data".
- `getProposalSolarIsotopicResonance` catch → **fallback `hybridVerdict: PASS`, 7D PASS, isotope `C-12`, scores 0.80**.

If Groover only checks `recommendation === 'PASS'`, a hammer exception looks like the sun said yes. Gate must also require a real NOAA snapshot (activity present, fetch not in the catch path) and reject the 0.80 C-12 fallback. Queue, never bypass.

Two more holes from the same files:

- **Quiet-outage bias:** `solarDataFetcher` channel failure synthesizes quiet-ish xray/kp (`1e-8` / 0) → activity `quiet` → **easier** PASS (strong 0.86). Storm closes the gate; a NOAA outage *opens* it. Do not treat quiet-from-missing-flux as sun-approved.
- **Temporal nonce:** proposal TDF XORs `Date.now()/1000` with xray micro-variation. The same mill DNA is a different vortex every second. PASS is a *moment*, not a property of the suit. Citation records that instant; it does not freeze the DNA's weather forever.

### Isotopes — what the code actually has

Three layers. They are not the same catalog.

| Layer | Where | What |
|---|---|---|
| **Tool catalog** | `mcp/index.ts` `list_isotopes` | Standard: C-12 (1.0), C-14 (0.8). Blurrn: Trinitarium-166 (1.666 = PHI), Chronovium-865 (0.865 = TAU), Vortexite-528 (0.528). |
| **Kuramoto map** | `mcp/lib/kuramotoOscillators.ts` `ISOTOPES` | **C-12 and C-14 only.** `runKuramotoCoupling(...)` defaults `isotopeType` to C-12. `govern_with_solar` does **not** pass `isotopeType` — live hammer isotope is always **C-12**. |
| **Wave dual-isotope** | `mcp/lib/wavePropagation.ts` | Every solar govern still cross-correlates a **C-12 series vs C-14 series** for `waveVortexAlignment` (proposal θ vs sun θ). Neural bands are scaled by those two factors. This is the isotopic comparison that actually runs. |
| **Narrative essences** | `mcp/lib/vortexMessage.ts` `ISOTOPE_ESSENCES` | C-12 grounded/slow, C-14 swift/bright, plus C-13/O/N/Fe flavors **not** in `list_isotopes`. Used to write "under a {essence} Sun." |
| **Fingerprint** | `isotopicSignal.ts` / `TemporalBlurrnSignal` | `{coreId, variantDelta, isotopicRatio, provenance}`. Fusion → `fused-core`. Not an ERC trait. |

Phase type from NOAA (`phaseTypeFromActivity`): quiet/moderate → **pull** ("The Sun draws this forward"); active/storm → **push** ("The Sun urges action").

**Rarity is UI, not an ERC trait.** `VortexClaim.tsx` `rarityTier` on 7D composite: Celestial ≥ 0.95, Resonant ≥ 0.78, Unstable ≥ 0.50, else Dissonant. Source chips: human / agent / ambient / system. Same thresholds in `VortexCard` / `MyVortices` / `DynamoDeploy`.

Blurrn isotopes (PHI / TAU / 528) are **engine constants**, not kinds of VRTX minted today. Do not wait for VRTX to grow an isotope trait.

### Leverage without a new GRVR contract

Copy from the cited `govern_with_solar` result into the 8004 `groover` block (and optionally the HUD): `isotope`, `phaseType`, `solarActivity`, `fullBox7DComposite`, `rarityTier` (derived), `hammerReason`, `containerId`. Citation on GRVR stays `bytes32(containerId)`.

Do **not** remap GRVR `variant` 0..15 from isotope — that slot is `hash(did, dna) % 16` (4 visor meshes × 4 colorways). Citation is the solar receipt; visor/color stay mill identity.

Future (Dynamo-side, not GRVR): pass `isotopeType` into Kuramoto from NOAA or from mill DNA hash so the hammer can actually select C-14 / Blurrn species. Until that exists, copied `isotope` will read `C-12` and the real isotopic story is the C-12/C-14 wave comparison + 7D rarity.

## Sepolia (v2 proving)

- `0x6C61feb8389c99EBf00576E7A110140866C5D9fF` (Level). v1 `0xFc644D08…` is history.

## Railway env

Code defaults are mainnet. If these vars are still Sepolia they **win** — flip them on the Groover Railway box:

```
GRVR_CONTRACT=0x7b184bf7B7054A7328a1D7851465c6001Bb2AFb3
GRVR_CHAIN_ID=8453
GRVR_RPC_URL=https://mainnet.base.org
GRVR_PRIVATE_KEY=
```

Live mint reads **only** `GRVR_PRIVATE_KEY`. `DEPLOYER_PRIVATE_KEY` / `GROOVER_MINTER_KEY` are ignored. Missing or empty `GRVR_PRIVATE_KEY` dry-runs (no tx). `dryRun: true` also dry-runs.

Reverted chain mints (`AlreadyMinted`, wrong minter) throw; MCP does not return `success: true`.

New schemas: add `packages/identity/src/packs/<id>.ts` implementing `PackAdapter`, then `registerPackAdapter` in `packs/index.ts`.
