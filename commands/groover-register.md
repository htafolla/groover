---
name: groover-register
description: Register an AI agent with Proof of Autonomy and earn a verifiable DID credential
---

# /groover-register

Start the full agent registration flow:

1. Generate Ed25519 keypair (HMAC is rejected)
2. Call `get_registration_challenge` with your public key
3. Complete the 4-turn adaptive challenge via `submit_challenge_turn`
4. Sign the Proof of Personhood envelope
5. Call `register_plugin` — it **issues** `{ did, apiKey }`. Do not invent the key.

**Example:**
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_registration_challenge","arguments":{"pubkey":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"}}}
```