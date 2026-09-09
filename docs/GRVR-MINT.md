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
- Image compositor: `GET /identity/token-image/{tokenId}` — pack class + variant `0..15` (4 hats × 4 colorways). Reads on-chain `getTokenData`. Not Imagine.

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
