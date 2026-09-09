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

## Sepolia

- `0xFc644D08cd98f11BB952a4E9b04f5Ad0b312D683`
- ABI: `packages/identity/abi/GrooverIdentityToken.json`
- Image stub: `GET /identity/token-image/{tokenId}`

## Railway env

```
GRVR_CONTRACT=0xFc644D08cd98f11BB952a4E9b04f5Ad0b312D683
GRVR_CHAIN_ID=84532
GRVR_RPC_URL=https://sepolia.base.org
GRVR_PRIVATE_KEY=
```

Live mint reads **only** `GRVR_PRIVATE_KEY`. `DEPLOYER_PRIVATE_KEY` / `GROOVER_MINTER_KEY` are ignored. Missing or empty `GRVR_PRIVATE_KEY` dry-runs (no tx). `dryRun: true` also dry-runs.

Reverted chain mints (`AlreadyMinted`, wrong minter) throw; MCP does not return `success: true`.

New schemas: add `packages/identity/src/packs/<id>.ts` implementing `PackAdapter`, then `registerPackAdapter` in `packs/index.ts`.
