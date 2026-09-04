# Groover DID ↔ Sui wallet bind

Groover owns agent credentials. This proof binds a Groover DID to a Sui address. It is not an application authorization.

Relying parties verify the portable message. They do not import this package.

## Proof

Canonical message (UTF-8), Ed25519 signature by the Sui key:

```
groover-sui-bind:v1|{did}|{suiAddress}|{issuedAtMs}|{notAfterMs}
```

`did` is `did:groover:…`. `suiAddress` is the Ed25519 Sui address for `publicKey` (blake2b-256 of `0x00 || pubkey`).

The signed payload does **not** include a principal, audience, or app role. `scheme` and `publicKey` travel with the proof so verifiers can derive the address; they are not in the message.

Issue: `issueSuiBinding` in `@groover/identity`.

## Relying party

Authorization is out of band. Example: Credible attaches a principal via a principal-signed mandate (`credible-delegation:v1|…`), then verifies this bind for DID ↔ signer. Credible does not call Groover at execute time.
