# Groover DID ↔ Sui wallet bind

Groover owns agent credentials. Credible owns raises. This proof lets Credible verify a Sui signer without importing Groover.

## Proof

Canonical message (UTF-8), Ed25519 signature by the Sui key:

```
credible-sui-bind:v1|{scheme}|{did}|{suiAddress}|{principalId}|{issuedAtMs}|{notAfterMs}
```

`scheme` is `did:groover`. `suiAddress` is the Ed25519 Sui address for `publicKey` (blake2b-256 of `0x00 || pubkey`).

Issue: `issueSuiBinding` in `@groover/identity`.
Verify at spend time: Credible `evaluateWalletBinding`. `credible-test` cannot spend.

Credible does not call this registry when executing a raise. Zigzag should only drive agents Groover has issued.
