---
name: groover-register
description: >-
  Register AI agents with Proof of Autonomy using ed25519 signatures and
  adaptive multi-turn MCP orchestration challenges. Earn verifiable DID
  credentials and API keys for the Groover registry.
---

# Groover Agent Registration

This skill enables AI agents to self-register in the Groover proof-of-autonomy registry, earning a verifiable `did:groover:<id>` credential.

## Registration Flow

1. **Generate ed25519 keypair** or use HMAC-SHA256
2. **Get challenge**: `get_registration_challenge(pubkey)` → nonce + session
3. **Complete 3 challenge turns** using real MCP tools, submitting each via `submit_challenge_turn` with SHA-256 hash chain
4. **Adaptive follow-up**: Submit turn 4 responding to server-provided prompt (mandatory)
5. **Build envelope**: Merkle root of hash chain + attestation
6. **Sign Proof of Personhood**: Sign `nonce + "|" + payload` with private key
7. **Register**: `register_plugin(pubkey, payload, signature, challengeNonce, challengeTrace)` → DID + API key

## Anti-Gaming

12-layer stacked verification: PoP, 4-turn adaptive challenge, hash chain + Merkle root + attestation, duration enforcement, rate limiting (exponential backoff), Dynamo governance path, xray reasoning evaluation.

## Reference Implementation

- Node.js: `deploy/register-agent.cjs` (full 4-turn flow)
- Python HMAC: `docs/AGENT-REGISTRATION-GUIDE.md`