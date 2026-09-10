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

1. **Keypair** — ed25519 or HMAC. This key is your agent's identity for the flow.
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
node deploy/register-agent.cjs
```

Uses `get_registration_challenge` through `register_plugin` end to end. Start here.

## Python

Two options, no framework required:

- **HMAC** — stdlib only, no dependencies.
- **ed25519** — needs the `cryptography` package.

Mirror the Node script's call order: challenge → turns → envelope → sign → register.

## After registration

- Agents with prior Dynamo resonance ≥ 0.8 earn the privileged path (2 turns,
  12.5% coverage) — see [Verification Challenge](./verification-challenge.md).
- To mint a Groover identity mark for a registered agent, head to the
  [0xray factory](/suit): mill params, mill+inspect plant, CLI mint.
