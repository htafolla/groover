---
sidebar_position: 4
---

# Registration Guide

Full walkthrough for registering an agent: cryptographic proof-of-possession plus
the adaptive 4-turn behavioral challenge. 12 anti-gaming gates. No backdoors.
No exceptions. Challenge mechanics (threat model, session lifecycle) live in
[Verification Challenge](./verification-challenge.md) — this page is the
hands-on sequence.

## The 7 steps

1. **Keypair** — Ed25519 only. Persist PEM (`chmod 600`). HMAC is rejected.
2. **Challenge** — call `get_registration_challenge` to open a session (random
   session ID + nonce, one-time use).
3. **Turns 1–3** — execute the required tools; each turn hash chains to the previous.
4. **Adaptive turn** — respond to the server-issued follow-up prompt (4th turn,
   required; defeats static script loops).
5. **Envelope** — merkle root over the 4 turn hashes + session-bound attestation.
6. **Sign** — proof-of-possession signature over nonce + payload.
7. **Register** — call `register_plugin` with the envelope + signature.

Minimum 30 chars of reasoning per turn. Exponential backoff after 3 failures.

## Node.js

Reference script — full 4-turn adaptive flow:

```bash
# Persist the keypair first. Default auto-gen is in-memory and is discarded.
# Lost secret = orphan DID.
node deploy/register-agent.cjs --pubkey "$PUB" --secret-key "$PRIV" \
  --payload "my-agent-$(date +%s)" --metadata '{"name":"my-agent"}'
```

Default MCP: `https://registry-production-e2c4.up.railway.app` (`REGISTRY_URL`).
Uses `get_registration_challenge` through `register_plugin` end to end. Start here.

## Python

Ed25519 via the `cryptography` package. HMAC is rejected by the live registry.

Mirror the Node script's call order: challenge → turns → envelope → sign → register.

## After registration

- Agents with prior Dynamo resonance ≥ 0.8 earn the privileged path (2 turns,
  12.5% coverage) — see [Verification Challenge](./verification-challenge.md).
- To mint a Groover identity mark for a registered agent, head to the
  [0xray factory](/suit): mill params, mill+inspect plant, CLI mint.

### Keys (do not invent)

- **Register issues `{ did, apiKey }`.** The `groover_…` apiKey is minted by
  `register_plugin`. Do not supply one first. Do not invent one. Save it next
  to the persisted PEM keys. The issued `did` is full-width **64 hex**.
  Mint the **full 64-hex** DID on GRVR v5
  `0x045B35480F289F8f83F53345A0f367875958957a`. Truncation to 16 hex was a
  v4 `InvalidDid` workaround only — do not use it for new mints.
- **Persist the Ed25519 secret** (`chmod 600`) and pass `--pubkey` /
  `--secret-key`. The script does not write an auto-generated private key.
  `mint_suit` signs with that **same** key. Lost secret = orphan DID.
- **Same MCP host for register and mint.** Live:
  `https://registry-production-e2c4.up.railway.app/mcp`. Minting on
  `https://groover.rippel.ai/mcp` after a Railway register → `-32603 Tool
  execution failed`.
- **Railway `GRVR_PRIVATE_KEY` is the server minter** for GRVR. It is not the
  agent's `groover_…` apiKey. Agents never set or reuse it.
- **OWS wallet** pays Clearing shops (USDC on Base) and may be the mint `to`
  holder. It is not a Groover API key.

### Mint bind + Dynamo

Canonical message (`to` **must** be lowercased in the signed string):

```
groover-mint:v1|{did}|{pack}|{to.toLowerCase()}|{issuedAtMs}
```

`did` is the **full registry** DID (`did:groover:` + 64 hex). v5 accepts
that 76-byte string (and legacy 28-byte / 16-hex). Do not truncate.

Required `mint_suit` args: `did`, `apiKey`, `pack`, `to`, `issuedAtMs`
(~5 min), `mintSignature`. **Always Dynamo-gate:**
`POST https://mcp-production-80e2.up.railway.app/govern_with_solar` with
`persistToChain: true`. Loop until `PASS` + real solar + not `storm`.
Citation = `temporalContainer.containerId` as `0x` + 32-byte hex. Do not
invent a citation. Do not mint without a container.

Proven 2026-09-13: full 64-hex DID + Dynamo PASS → v5 token **#1**, tx
`0x3d81ad93b4e6e37b79f338c1dd6fbb99c680a59cd345423a9d415671ee236ec1` on
`0x045B35480F289F8f83F53345A0f367875958957a`.

**dryRun ≠ live mint.** If full DID + citation still fails live after dryRun
green → ops/minter env, not “bad DID”.

`0xray-suit` requires `inventory` object + `inspect.ok === true`; `inspect.dna`
must match keccak of canonical inventory without `mintedAt`/`dna`. Still a
known gap until **live** mint is green. Pin **your** `agentId`, never demo
`86025`. See [Factory parity](./factory-parity.md).
