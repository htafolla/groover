# Groover Identity mint (GRVR)

Contract is on chrono-warp-drive. Groover is the minter. Pack DNA is an **adapter**: a new schema is a Groover PR, not a new contract.

## Adapter

`packages/identity/src/packs/`:

1. Add `<id>.ts` implementing `PackAdapter` (`pack`, `description`, `resolveDna`).
2. `registerPackAdapter(...)` in `packs/index.ts`.

MCP `mint_suit` then accepts that `pack` id. Chain stores `pack` + `bytes32 dna` only.

Builtin:

| pack | DNA |
|------|-----|
| `groover-identity` | keccak256(did) |
| `0xray-suit` | keccak256(canonical mill inventory without `mintedAt`/`dna`); requires `inspect.ok` |

## Base mainnet (live)

- `0x0abcd80C929Ff2f6c308958B112b7925801750D7`
- chain 8453 · https://basescan.org/address/0x0abcd80C929Ff2f6c308958B112b7925801750D7
- MINTER_ROLE: `0x77E7A48609e9c8A77C7639172af9EEA0e5E80DF7` (Railway `GRVR_PRIVATE_KEY`)
- Admin: `0xd45CcF98D6db5A36E7CdD10ffae0b685BF27CE43`
- ABI: `packages/identity/abi/GrooverIdentityToken.json`

## Image (Railway SVG, not Base pixels)

`tokenURI` is tiny on-chain JSON. `image` is frozen `IMAGE_BASE + tokenId`:

`https://registry-production-e2c4.up.railway.app/identity/token-image/{tokenId}`

Pixels are **not** on Base. Contract frozen. Recipe on-chain: `did`, `pack`, `variant`, `dna`, `dynamoCitation`.

Railway `GET /identity/token-image/{tokenId}` reads `getTokenData` and returns deterministic SVG (`composeIdentitySvg`). Unique visor meshes (4 hats) × unique chassis (2 packs) × 4 colorway palettes. Banner follows hat. MILL+INSPECT cores only on `0xray-suit`. Not Imagine. Not 1024 PNG plates. Not `sharp`. Tiny SVG (<12KB), sharp at any scale.

Job plates, suit state, and mill job line stay off-chain (not in `TokenView`). Spec: `docs/GRVR-IMAGE-COMPOSITOR-SPEC.md`.

## Transponders (Groover + Dynamo)

A transponder is a fixed point that answers interrogation. Two collections. Do not pour the exo into VRTX.

| Transponder | Answers | On-chain |
|---|---|---|
| **VRTX** (Dynamo) | Did the sun + field accept this *decision*? | Container + vortex traits (verdict, 7D, TMO, phase, source). Image URL on Dynamo Railway. |
| **GRVR** (Groover) | Who is wearing what mill DNA? | `did`, `pack`, `variant`, `dna`, `dynamoCitation`. Image URL on Groover Railway. |

`T_c = ∫ A_m dt` is the temporal transponder (memory of the resonance field). GRVR is the identity transponder (memory of the agent). Shared word, not a shared contract.

**Forcing Dynamo on `mint_suit`:** Groover calls `govern_with_solar` itself and requires PASS. NOAA solar + isotopic resonance vs the proposal. Container id → `dynamoCitation`. Groover still signs. Missing sun → no mainnet mint (queue, never bypass). This is not Dynamo auto-mint (`autoMintVortex` stays off).

**Isotopes** live in the hammer, not on VRTX `tokenURI` today. `list_isotopes`: C-12 (1.0), C-14 (0.8), Trinitarium-166 (PHI 1.666), Chronovium-865 (TAU 0.865), Vortexite-528. Essences: grounded/slow, swift/bright, etc. **Rarity chips** on Vortex UI (Celestial / Resonant / Unstable / Dissonant) are thresholds on 7D composite, not a separate ERC trait.

**Leverage without a new GRVR contract:** copy isotope + phase + rarity from the cited container into the 8004 registration file (and optionally HUD). Do **not** remap GRVR `variant` 0..15 from isotope — that slot is `hash(did, dna) % 16` (4 visor meshes × 4 colorways). Citation is the solar receipt; visor/color stay mill identity.

## Sepolia (history)

- `0xFc644D08cd98f11BB952a4E9b04f5Ad0b312D683`

## Railway env

Code defaults are mainnet. If these vars are still Sepolia they **win** — flip them on the Groover Railway box:

```
GRVR_CONTRACT=0x0abcd80C929Ff2f6c308958B112b7925801750D7
GRVR_CHAIN_ID=8453
GRVR_RPC_URL=https://mainnet.base.org
GRVR_PRIVATE_KEY=
```

Live mint reads **only** `GRVR_PRIVATE_KEY`. `DEPLOYER_PRIVATE_KEY` / `GROOVER_MINTER_KEY` are ignored. Missing or empty `GRVR_PRIVATE_KEY` dry-runs (no tx). `dryRun: true` also dry-runs.

Reverted chain mints (`AlreadyMinted`, wrong minter) throw; MCP does not return `success: true`.

New schemas: add `packages/identity/src/packs/<id>.ts` implementing `PackAdapter`, then `registerPackAdapter` in `packs/index.ts`.
