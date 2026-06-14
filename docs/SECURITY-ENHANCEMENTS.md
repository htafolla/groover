# Security Enhancements — Proof-of-Possession + Onchain Registry + Key Expiry

> Design by Architect. Research by Researcher. MVP Phase 2 scope.

## 1. Proof-of-Possession Key Issuance

### Current Problem
`registerPlugin` accepts a hex `pubkey` + payload, generates an HMAC server-side, and issues an API key with **zero proof** that the caller controls the private key. Any agent (or human) gets a key just by calling the endpoint.

### Design

```
Agent                          Groover Registry
  │                                   │
  │  1. Generate ed25519 keypair      │
  │     (client-side, never shared)   │
  │                                   │
  │  2. POST /mcp tools/call          │
  │     name: get_registration_challenge
  │                                   │
  │                              ←────│  Challenge: random 32-byte nonce
  │                                   │  (stored server-side, TTL 5 min)
  │                                   │
  │  3. Sign { nonce + payload }      │
  │     with private key              │
  │                                   │
  │  4. POST /mcp tools/call          │
  │     name: register_plugin         │
  │     args: {                       │
  │       pubkey: PEM,               │
  │       payload: "...",            │
  │       signature: hex,            │
  │       challengeNonce: "..."      │
  │     }                             │
  │                                   │
  │                              ────→│  5. Lookup nonce, verify not used
  │                                   │  6. Verify signature with verifyWithPublic()
  │                                   │  7. Mark nonce used (prevent replay)
  │                                   │  8. Mint DID + issue API key
  │                                   │
  │  ←──── { did, apiKey, expiry }    │
```

### API Changes

**New endpoint:** `get_registration_challenge` (MCP tool)
- Returns `{ nonce: "hex", ttl: 300 }`
- Nonce stored server-side in a `Map<string, { nonce, createdAt, used }>`

**Updated endpoint:** `register_plugin`
- New optional fields: `signature: string`, `challengeNonce: string`
- If both provided: verify `verifyWithPublic(pubkey, challengeNonce + payload, signature)` before issuing key
- If neither provided: fall back to current HMAC flow (backward compat)

### Security
- Nonce is single-use (replay protection)
- 5-minute TTL on challenges
- `pubkey` is PEM-encoded ed25519 public key (not hex)
- Uses existing `verifyWithPublic()` in identity package (no new crypto code)

---

## 2. Onchain Registry on Base (L2)

### Contract Interface

```solidity
// contracts/GrooverAgentRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GrooverAgentRegistry {
    address public owner;

    struct AgentRecord {
        bytes32 pubkeyHash;   // keccak256(publicKey)
        bytes32 apiKeyHash;   // keccak256(apiKey)
        uint256 registeredAt;
        uint256 expiry;       // timestamp, 0 = never
        bool active;
    }

    mapping(bytes32 => AgentRecord) public agents;  // didHash => record
    bytes32[] public activeAgents;                   // enumerable

    event AgentRegistered(bytes32 indexed didHash, bytes32 pubkeyHash, uint256 expiry);
    event KeyRenewed(bytes32 indexed didHash, bytes32 newApiKeyHash, uint256 newExpiry);
    event AgentRevoked(bytes32 indexed didHash);

    function register(bytes32 didHash, bytes32 pubkeyHash, bytes32 apiKeyHash, uint256 expiry) external {
        require(agents[didHash].registeredAt == 0, "already registered");
        agents[didHash] = AgentRecord(pubkeyHash, apiKeyHash, block.timestamp, expiry, true);
        activeAgents.push(didHash);
        emit AgentRegistered(didHash, pubkeyHash, expiry);
    }

    function renew(bytes32 didHash, bytes32 newApiKeyHash, uint256 newExpiry) external {
        require(agents[didHash].active, "not active");
        agents[didHash].apiKeyHash = newApiKeyHash;
        agents[didHash].expiry = newExpiry;
        emit KeyRenewed(didHash, newApiKeyHash, newExpiry);
    }

    function deactivate(bytes32 didHash) external {
        require(msg.sender == owner, "only owner");
        agents[didHash].active = false;
        emit AgentRevoked(didHash);
    }
}
```

### Hybrid Architecture

```
┌─────────────────────────────────────────────────┐
│                  MCP Server                      │
│  ┌──────────────┐    ┌────────────────────────┐  │
│  │ RegistryCache │◄──►│   Chain Sync Service   │  │
│  │ (in-memory)   │    │  (polls events, syncs) │  │
│  └──────┬───────┘    └───────────┬────────────┘  │
│         │                        │               │
│  ┌──────▼───────┐    ┌──────────▼────────────┐  │
│  │ register_plugin│   │   Ethereum RPC        │  │
│  │ search_plugins │   │   (Base L2)           │  │
│  │ renew_plugin   │   └───────────────────────┘  │
│  └────────────────┘                              │
└─────────────────────────────────────────────────┘
```

**Data model:**

| Layer | Data | Storage |
|-------|------|---------|
| Onchain (Base) | { didHash, pubkeyHash, apiKeyHash, expiry, active } | Solidity mapping |
| Offchain cache | Full PluginRecord (metadata, uiManifest, reputation, etc.) | In-memory Map |
| Events | Registration, Renewal, Revocation | Base event logs |

**Costs on Base:**
- Deploy contract: ~85,000 gas (~$0.02)
- Register: ~65,000 gas (~$0.01-0.02)
- Renew: ~40,000 gas (~$0.01)
- Deactivate: ~25,000 gas (~$0.005)

---

## 3. Key Expiry + Periodic Reverification

### Status Lifecycle

```
    ┌─────────┐
    │ Pending │  (challenge issued, awaiting signature)
    └────┬────┘
         │ verify PoP
    ┌────▼─────┐
    │  Active  │ ◄─────────────────────┐
    └────┬─────┘                       │
         │                             │
    ┌────▼─────┐  passed challenge     │
    │  Grace   │───────────────────────┘
    └────┬─────┘  (renew before expiry)
         │ failed to renew in 72h
    ┌────▼─────┐
    │ Expired  │───────────────────────┐
    └────┬─────┘                       │
         │                             │
    ┌────▼─────────┐                   │
    │ Reactivating │───────────────────┘
    └──────────────┘  (same pubkey, fresh challenge)
```

### Tiered Expiry

| Tier | Lifetime | Rotation | Cost |
|------|----------|----------|------|
| **API key** (offchain) | 24h | Auto via `renew_plugin` tool | Free |
| **Registration** (offchain) | 90d | Full re-challenge if expired | Free |
| **Onchain anchor** | Indefinite | Only written on create/reactivate/revoke | ~$0.01/tx |

### Updated PluginRecord

```typescript
interface PluginRecord {
  did: string;
  pubkey: string;
  signature: string;
  apiKey: string;
  status: 'active' | 'grace' | 'expired';
  apiKeyIssuedAt: string;
  apiKeyExpiresAt: string;
  registrationExpiresAt: string;  // 90d from registration
  lastVerifiedAt: string;
  metadata: Record<string, unknown>;
  registeredAt: string;
  reputation: number;
  uiManifest?: import('./agent-ui-manifest.js').AgentUiManifest;
}
```

### New Endpoint: `renew_plugin`

1. Agent calls `renew_plugin` with `{ did, signature: sign(nonce + did) }`
2. Server verifies signature against stored pubkey
3. Server issues new API key (old one invalidated)
4. Updates `apiKeyExpiresAt = now + 24h`, `lastVerifiedAt = now`
5. Returns `{ newApiKey, newExpiry }`

### Reputation Decay

```typescript
function getEffectiveReputation(record: PluginRecord): number {
  const hoursSinceVerify = (Date.now() - new Date(record.lastVerifiedAt).getTime()) / 3600000;
  if (record.status === 'active') return record.reputation;
  if (record.status === 'grace') return record.reputation * Math.max(0.5, 1 - (hoursSinceVerify - 24) / 48);
  return 0; // expired
}
```

### Background Sweeper

Every 5 minutes, a sweeper marks agents as:
- `grace` if API key expired < 72h ago
- `expired` if API key expired > 72h ago OR registration expired > 90d

---

## Migration Path

1. **Phase 2a**: Add PoP challenge + proof-of-possession to `registerPlugin` (offchain only)
2. **Phase 2b**: Add `renew_plugin` endpoint + key expiry fields to `PluginRecord`
3. **Phase 2c**: Write Base contract, integrate via `viem` or `ethers`
4. **Phase 2d**: Add chain sync service + background sweeper
5. **Phase 2e**: Migration script to onboard existing in-memory agents to chain

## Files to Change/Create

| File | Action |
|------|--------|
| `packages/marketplace/src/index.ts` | Modify `registerPlugin`, add `renewPlugin`, add expiry logic |
| `packages/marketplace/src/mcp-server.ts` | Add `get_registration_challenge`, `renew_plugin` tools |
| `packages/marketplace/src/index.test.ts` | Add PoP + expiry tests |
| `packages/identity/src/index.ts` | Add challenge nonce generation (optional) |
| `packages/contracts/GrooverAgentRegistry.sol` | **New** - Base L2 contract |
| `packages/contracts/hardhat.config.ts` | **New** - Hardhat config for Base |
| `packages/registry/src/chain-sync.ts` | **New** - Event listener + cache sync |
| `deploy/confirm-railway-endpoints.ts` | Add PoP + expiry endpoint checks |
| `docs/SECURITY-ENHANCEMENTS.md` | This file |
