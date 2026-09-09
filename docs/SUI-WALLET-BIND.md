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

Issue locally: `issueSuiBinding` in `@groover/identity`.

Issue on the registry (after Proof of Autonomy): MCP `issue_sui_binding` with the DID’s API key. The Sui key **must be the same Ed25519 key** used to register. DID is `sha256(32-byte-hex-pubkey).slice(0,16)` — PEM and hex of that key mint the same DID.

Lookup (public): MCP `get_sui_binding({ did })`. Relying parties may call this at **mandate issue** time. Do not call Groover at raise execute time.

## Relying party

Authorization is out of band. Example: Credible attaches a principal via a principal-signed mandate (`credible-delegation:v1|…`), then verifies this bind for DID ↔ signer. Optional: confirm the DID has a registry bind via `get_sui_binding`.
