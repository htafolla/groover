# Groover Security Enhancements v2 — Design Document

**Author**: Systems Architecture — Groover Project  
**Date**: 2026-06-14  
**Status**: Draft for review  
**Target**: Phase 2 security hardening atop Phase 1 MVP (5 packages, in-memory registry, deployed Railway MCP)

---

## Architecture Overview

The three enhancements form a layered security model:

```
┌──────────────────────────────────────────────────────────────┐
│                    Enhancement Layer Map                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  E1: Proof-of-Possession Key Issuance                        │
│  ── Client-side ed25519 signing before server issues API key │
│  ── Eliminates server-only HMAC binding                      │
│                                                              │
│  E3: Periodic Reverification + Key Expiry                    │
│  ── 24h TTL on API keys, grace window, reputation decay      │
│  ── Background sweeper for stale agents                      │
│                                                              │
│  E2: Onchain Registry on Base (L2)                           │
│  ── Solidity contract as SSOT for agent records              │
│  ── In-memory cache layer for fast reads                     │
│  ── Write-through / read-through hybrid                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Key principles**:
- **Defence in depth**: PoP prevents impersonation, expiry limits blast radius, onchain provides tamper-proof SSOT.
- **Backward compatibility**: Every enhancement degrades gracefully (HMAC fallback, cache-only mode, unlimited keys).
- **Minimal new dependencies**: Solidity via forge/hardhat, ethers v6 for chain ops — otherwise pure Node crypto.

---

## Enhancement 1: Proof-of-Possession Key Issuance

### Problem
`registerPlugin()` currently calls `bindForRegistration()` which computes an HMAC-SHA256 **server-side** using the provided `pubkey` hex string as key material. The agent never proves possession of a private key — the server generates the "signature". Anyone who can send a hex string gets a bound DID + API key.

### Design

**Client-side (agent) flow**:
```
Agent                                   Server (marketplace)
  │                                         │
  │  generateKeyPair()                      │
  │  ├─ ed25519 PEM keypair                 │
  │  │                                      │
  │  signPayload(privKeyPEM, payload)       │
  │  ├─ hex signature                       │
  │  │                                      │
  │  POST registerPlugin {                  │
  │    pubkey: <PEM>,                       │
  │    payload: <string>,                   │
  │    signature: <hex>,                    │
  │    metadata: {...}                      │
  │  } ──────────────────────────────────►  │
  │                                         │  verifyWithPublic(PEM, payload, sig)
  │                                         │  ├─ crypto.verify('ed25519', ...)
  │                                         │  ├─ PASS → continue
  │                                         │  └─ FAIL → return 401
  │                                         │
  │                                         │  generateDID(pubkey) + generateApiKey(did)
  │                                         │
  │  ◄────────────────────────────────────  │  { did, apiKey, expiresAt, ... }
  │                                         │
```

**Backward compat (HMAC fallback)**:
```
Agent (legacy)                            Server
  │                                         │
  │  POST registerPlugin {                  │
  │    pubkey: <hex>,                       │  ← hex detected, no signature
  │    payload: <string>,                   │
  │    metadata: {...}                      │
  │    // no signature provided             │
  │  } ──────────────────────────────────►  │
  │                                         │  bindCrypto(pubkeyHex, payload)  // HMAC
  │                                         │  ← identical to current behavior
```

### Protocol Detection Logic

| `pubkey` format | `signature` present | Behaviour |
|---|---|---|
| PEM (starts with `-----BEGIN PUBLIC KEY-----`) | Yes | ed25519 verify via `verifyWithPublic()` |
| PEM | No | Reject (PEM without POP is invalid) |
| Hex (64+ hex chars) | Yes | Treat as PoP attempt — verify via `verifyWithPublic()` (will likely fail if hex ≠ PEM) |
| Hex | No | Fall back to HMAC `bindCrypto()` (legacy) |

### Identity API Changes

`bindForRegistration()` gets a new signature:

```typescript
// Updated: accepts optional pre-verified signature
export function bindForRegistration(
  pubkey: string,
  payload: string,
  metadata: Record<string, unknown> = {},
  verifiedSignature?: string,       // NEW: if provided, skip HMAC
): IdentityBinding
```

Internal logic:
- If `verifiedSignature` is provided → use `did = generateDID(pubkey)`, `apiKey = generateApiKey(did)`, `signature = verifiedSignature`, `ok = true`
- If not → existing HMAC flow

### PluginRecord

No structural change — `pubkey` field already exists. Only enforcement changes.

---

## Enhancement 2: Onchain Registry on Base (L2)

### Design Overview

```
                    ┌──────────────────┐
                    │  In-Memory Cache │  ← Map<string, PluginRecord> (existing)
                    │  (read-through)  │
                    └──────┬───────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     Write-through:              Read-through:
     registerPlugin() →          getPlugin() →
     submit tx →                 cache hit? → return
     await receipt →             cache miss? →
     update cache                query chain →
                                   populate cache →
                                   return
              │                         │
              └────────────┬────────────┘
                           │
              ┌────────────┴────────────┐
              │  GrooverRegistry.sol    │  ← deployed on Base mainnet/testnet
              │  (SSOT for records)     │
              └─────────────────────────┘
```

### Smart Contract Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract GrooverRegistry {
    enum AgentStatus { Active, Grace, Expired, Revoked }

    struct AgentRecord {
        bytes32 pubkeyHash;       // keccak256(publicKeyPEM)
        bytes32 apiKeyHash;       // keccak256(apiKey)
        uint256  expiry;          // unix timestamp
        AgentStatus status;
        uint256  reputation;      // scaled by 1e4 (1.0 = 10000)
    }

    bytes32 public constant DOMAIN_SEPARATOR = keccak256("GrooverRegistry_v1");

    // didHash = keccak256(did) — allows any DID scheme
    mapping(bytes32 => AgentRecord) public agents;
    mapping(bytes32 => uint256)     public registrationBlock;   // block when registered

    // ── Events ──────────────────────────────────────────────
    event AgentRegistered(
        bytes32 indexed didHash,
        bytes32 indexed pubkeyHash,
        bytes32 indexed apiKeyHash,
        uint256  expiry,
        uint256  timestamp
    );

    event AgentRenewed(
        bytes32 indexed didHash,
        uint256  newExpiry,
        uint256  timestamp
    );

    event AgentRevoked(
        bytes32 indexed didHash,
        AgentStatus previousStatus,
        uint256  timestamp
    );

    event AgentStatusChanged(
        bytes32 indexed didHash,
        AgentStatus from,
        AgentStatus to,
        uint256  timestamp
    );

    // ── Write Functions ──────────────────────────────────────
    function register(
        bytes32 didHash,
        bytes32 pubkeyHash,
        bytes32 apiKeyHash,
        uint256 expiry
    ) external {
        require(agents[didHash].expiry == 0, "Already registered");
        agents[didHash] = AgentRecord({
            pubkeyHash:  pubkeyHash,
            apiKeyHash:  apiKeyHash,
            expiry:      expiry,
            status:      AgentStatus.Active,
            reputation:  10000
        });
        registrationBlock[didHash] = block.number;
        emit AgentRegistered(didHash, pubkeyHash, apiKeyHash, expiry, block.timestamp);
    }

    function renew(bytes32 didHash, uint256 newExpiry) external {
        require(agents[didHash].expiry > 0, "Not registered");
        require(agents[didHash].status != AgentStatus.Revoked, "Revoked");
        agents[didHash].expiry = newExpiry;
        agents[didHash].status = AgentStatus.Active;
        emit AgentRenewed(didHash, newExpiry, block.timestamp);
    }

    function revoke(bytes32 didHash) external {
        require(agents[didHash].expiry > 0, "Not registered");
        AgentStatus prev = agents[didHash].status;
        agents[didHash].status = AgentStatus.Revoked;
        emit AgentRevoked(didHash, prev, block.timestamp);
    }

    function setStatus(bytes32 didHash, AgentStatus newStatus) external {
        require(agents[didHash].expiry > 0, "Not registered");
        AgentStatus prev = agents[didHash].status;
        agents[didHash].status = newStatus;
        emit AgentStatusChanged(didHash, prev, newStatus, block.timestamp);
    }

    // ── Read Functions ───────────────────────────────────────
    function getAgent(bytes32 didHash) external view
        returns (AgentRecord memory)
    {
        return agents[didHash];
    }

    function isActive(bytes32 didHash) external view returns (bool) {
        AgentRecord memory a = agents[didHash];
        return a.expiry > 0
            && a.status == AgentStatus.Active
            && a.expiry >= block.timestamp;
    }
}
```

### Gas Cost Estimates (Base L2)

| Operation | Gas Estimate | Est. Cost at 0.001 gwei |
|---|---|---|
| `register()` | ~95,000–120,000 | $0.00019–$0.00024 |
| `renew()` | ~45,000–60,000 | $0.00009–$0.00012 |
| `revoke()` | ~28,000–35,000 | $0.00006–$0.00007 |
| `getAgent()` (view) | 0 | $0 |
| `isActive()` (view) | 0 | $0 |

Base L2 average gas price ~0.001–0.01 gwei as of 2026. Annual cost for 10,000 registrations + 10,000 renewals ≈ **$3–$6 USD**.

### Cache Layer (TypeScript)

```typescript
// packages/blockchain/src/CacheLayer.ts

export class AgentCacheLayer {
  private cache = new Map<string, PluginRecord>();

  constructor(
    private chain: BaseConnector,
    private ttlMs: number = 30_000,   // cache TTL
  ) {}

  async get(did: string): Promise<PluginRecord | undefined> {
    // Read-through: cache hit → return (if fresh)
    const cached = this.cache.get(did);
    if (cached && this.isFresh(cached)) return cached;

    // Cache miss → query chain
    const chainRecord = await this.chain.getAgent(did);
    if (!chainRecord) return undefined;

    const record = this.toPluginRecord(did, chainRecord);
    this.cache.set(did, record);
    return record;
  }

  async set(did: string, record: PluginRecord): Promise<void> {
    // Write-through: chain first, then cache
    await this.chain.registerAgent(record);
    this.cache.set(did, record);
  }

  private isFresh(record: PluginRecord): boolean {
    const age = Date.now() - new Date(record.verifiedAt).getTime();
    return age < this.ttlMs;
  }
}
```

---

## Enhancement 3: Periodic Reverification + Key Expiry

### PluginRecord Extension

```typescript
// packages/marketplace/src/index.ts

export type AgentStatus = 'active' | 'grace' | 'expired' | 'revoked';

export interface PluginRecord {
  did: string;
  pubkey: string;
  signature: string;
  apiKey: string;
  metadata: Record<string, unknown>;
  registeredAt: string;
  reputation: number;

  // NEW fields:
  status: AgentStatus;
  expiresAt: string;         // ISO-8601 (e.g. reg + 24h)
  lastVerifiedAt: string;    // ISO-8601

  uiManifest?: import('./agent-ui-manifest.js').AgentUiManifest;
}
```

### Registration Flow (updated)

```
registerPlugin(pubkey, payload, signature, metadata)
  │
  ├─ PoP verify (E1) ── FAIL → return 401
  │
  ├─ Bind identity → DID
  │
  ├─ Set:
  │    expiresAt = now + 24h
  │    status = 'active'
  │    lastVerifiedAt = now
  │    reputation = 1.0
  │
  ├─ Store in registry (cache / chain)
  │
  └─ Return PluginRecord with expiresAt, status
```

### New Endpoint: `renewPlugin`

```typescript
// packages/marketplace/src/index.ts

export async function renewPlugin(params: {
  did: string;
  pubkey: string;
  payload: string;
  signature: string;
}): Promise<PluginRecord | { error: string }> {
  // 1. Lookup existing record
  const existing = registry.get(params.did);
  if (!existing) return { error: 'not_found' };
  if (existing.status === 'revoked') return { error: 'revoked' };
  if (existing.status === 'expired') return { error: 'expired' };

  // 2. Verify PoP (same as E1)
  const valid = verifyWithPublic(params.pubkey, params.payload, params.signature);
  if (!valid) return { error: 'invalid_signature' };

  // 3. Extend
  const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  existing.expiresAt = newExpiry.toISOString();
  existing.lastVerifiedAt = new Date().toISOString();
  existing.status = 'active';
  existing.reputation = Math.min(1.0, existing.reputation + 0.05); // small reward

  // 4. Optionally rotate API key
  existing.apiKey = generateApiKey(existing.did);

  registry.set(params.did, existing);
  return existing;
}
```

MCP tool registration (in `mcp-server.ts`):
```typescript
case 'renew_plugin': {
  const result = await renewPlugin(request.arguments as any);
  return { success: !('error' in result), record: result };
}
```

### Background Sweeper

```typescript
// packages/marketplace/src/expiry-sweeper.ts

export type SweepAction = { did: string; from: AgentStatus; to: AgentStatus };

export function sweepExpired(
  registry: Map<string, PluginRecord>,
  gracePeriodMs: number = 7 * 24 * 60 * 60 * 1000   // 7 days
): SweepAction[] {
  const actions: SweepAction[] = [];
  const now = Date.now();

  for (const [did, record] of registry) {
    if (record.status === 'revoked' || record.status === 'expired') continue;

    const expiresAt = new Date(record.expiresAt).getTime();
    const elapsed = now - expiresAt;

    if (elapsed <= 0) continue; // still valid

    if (record.status === 'active' && elapsed > 0 && elapsed <= gracePeriodMs) {
      // Grace period
      const oldStatus = record.status;
      record.status = 'grace';
      record.reputation = Math.max(0.3, record.reputation - 0.1);
      actions.push({ did, from: oldStatus, to: 'grace' });
    } else if (elapsed > gracePeriodMs || record.status === 'grace') {
      // Hard expiry
      const oldStatus = record.status;
      record.status = 'expired';
      record.reputation = 0;
      actions.push({ did, from: oldStatus, to: 'expired' });
    }
  }

  return actions;
}

// Optional: periodic loop
export function startSweeper(
  registry: Map<string, PluginRecord>,
  intervalMs: number = 5 * 60 * 1000   // every 5 min
): NodeJS.Timeout {
  return setInterval(() => {
    const actions = sweepExpired(registry);
    for (const a of actions) {
      frameworkLogger.log('marketplace', 'sweep-action', 'info', a);
    }
  }, intervalMs);
}
```

### Reverification Flow (Timer-Based)

```
Agent                              Server
 │                                    │
 │  registerPlugin()                  │
 │  ─────────────────────────────►    │  returns { apiKey, expiresAt: now+24h, status:'active' }
 │                                    │
 │  [24 hours pass]                   │
 │                                    │  sweeper: active → grace
 │                                    │  reputation: 1.0 → 0.9
 │                                    │
 │  MCP call fails (401)              │
 │  └─ agent detects stale key        │
 │                                    │
 │  renewPlugin(did, pubkey,          │
 │    payload, signature)             │
 │  ─────────────────────────────►    │  verify PoP, extend 24h, rotate apiKey
 │  ◄─────────────────────────────    │  { apiKey: new, expiresAt: now+24h }
 │                                    │
 │  [another 24h passes]              │
 │  (agent does NOT renew)            │
 │                                    │  sweeper: grace → expired
 │                                    │  reputation: 0
```

---

## Migration Path

### Phase A — Enhancement 1 (PoP Issuance)
1. Update `registerPlugin` params to accept optional `signature` field
2. Add PEM detection helper in marketplace
3. Stub `verifyWithPublic` call; if signature present & PEM, verify
4. Update `identityEngine.bindForRegistration` to accept `verifiedSignature?`
5. Keep HMAC fallback for existing callers
6. Update MCP server `register_plugin` handler to forward `signature`
7. **Tests**: PoP success, PoP failure, HMAC fallback, PEM without sig rejection

### Phase B — Enhancement 3 (Expiry + Reverification)
1. Add `status`, `expiresAt`, `lastVerifiedAt` to `PluginRecord`
2. Update `registerPlugin` to set 24h expiry on new records
3. Implement `renewPlugin` function with PoP verification
4. Register `renew_plugin` in MCP tool list
5. Implement `sweepExpired` + `startSweeper`
6. Wire sweeper into `mcp-server.ts` (start on boot)
7. **Tests**: 24h expiry, renew extends, grace→expired decay

### Phase C — Enhancement 2 (Onchain Registry)
1. Create `packages/blockchain/` directory
2. Write `contracts/GrooverRegistry.sol`, compile with forge
3. Implement `BaseConnector` (ethers v6, provider + wallet)
4. Implement `CacheLayer` wrapping existing `Map` + chain calls
5. Refactor `marketplace` to use `CacheLayer` instead of raw `Map`
6. Deploy to Base Sepolia testnet first; mainnet after audit
7. Configure via env: `BASE_RPC_URL`, `BASE_REGISTRY_ADDRESS`
8. **Tests**: contract unit tests (forge), connector integration tests, cache hit/miss/L2 fallback

### Rollback Strategy
- E1: Remove `signature` param, revert to HMAC-only (trivial)
- E3: Remove sweeper, set `status: undefined`, default `expiresAt: far future`
- E2: Swap `CacheLayer` back to raw `Map` via DI toggle

---

## Security Analysis

### Threat Model

| Threat | E1 (PoP) | E3 (Expiry) | E2 (Onchain) |
|---|---|---|---|
| Impersonation — attacker registers with stolen pubkey | ❌ — PoP proves key possession | — | — |
| Replay — old registration replayed to get new key | — | ✅ — 24h TTL limits window | ✅ — onchain record prevents duplicate |
| Stale key abuse after agent compromise | — | ✅ — 24h max window | ✅ — revoke tx kills key |
| Registry tampering (server compromise) | — | — | ✅ — contract is SSOT |
| Server-side API key leak | — | ✅ — automatic rotation on renew | — |
| Front-running registration tx | — | — | ⚠️ — mitigated by tx reorg protection |
| Sybil / mass registration | ⚠️ — PoP only proves key possession | ⚠️ — expiry limits but does not prevent | ⚠️ — gas cost ($0.0002/reg) raises bar |

### Assumptions & Trust
1. Registry operator (Railway deploy) is trusted for cache layer — E2 shifts trust to L1/L2 consensus
2. Private keys never leave agent's control (E1) — compromised agent = compromised key
3. Base L2 finality ~2 sec — write-through adds latency to registration

### Cryptographic Summary

| Mechanism | Algorithm | Key Size | Source |
|---|---|---|---|
| PoP signing | Ed25519 (RFC 8032) | 256-bit | `crypto.generateKeyPairSync('ed25519')` |
| PoP verification | Ed25519 (RFC 8032) | 256-bit | `crypto.verify(null, ...)` |
| Fallback HMAC | HMAC-SHA256 | 256-bit | `crypto.createHmac('sha256', ...)` |
| DID hash | SHA-256 (truncated 16 hex) | 64-bit | `crypto.createHash('sha256')` |
| Chain pubkey hash | keccak256 | 256-bit | Solidity built-in |
| API key entropy | 24 bytes random | 192-bit | `crypto.randomBytes(24)` |

---

## File-by-File Change List

### Enhancement 1 — Proof-of-Possession Key Issuance

| File | Change |
|---|---|
| `packages/marketplace/src/index.ts` | Accept `signature?: string` in `registerPlugin` params; add PEM detection; call `verifyWithPublic()` before `bindForRegistration`; pass `verifiedSignature` to `bindForRegistration` |
| `packages/identity/src/index.ts` | Update `bindForRegistration()` to accept optional `verifiedSignature`; skip HMAC when provided; update `IdentityBinding` |
| `packages/marketplace/src/mcp-server.ts` | Forward `signature` from `register_plugin` MCP arguments |
| `packages/marketplace/src/index.test.ts` | Add tests: PoP flow, PoP failure, HMAC fallback, PEM without sig |
| `TECH-SPEC.md` (docs) | Note PoP requirement for enhanced security |

### Enhancement 2 — Onchain Registry on Base

| File | Change |
|---|---|
| `packages/blockchain/contracts/GrooverRegistry.sol` | **NEW** — Solidity contract with register/renew/revoke/isActive |
| `packages/blockchain/src/BaseConnector.ts` | **NEW** — Ethers v6 wrapper: `getAgent`, `registerAgent`, `renewAgent`, `revokeAgent` |
| `packages/blockchain/src/CacheLayer.ts` | **NEW** — Read-through/write-through cache over `BaseConnector` |
| `packages/blockchain/src/index.ts` | **NEW** — Package entrypoint exporting `BaseConnector`, `CacheLayer` |
| `packages/blockchain/package.json` | **NEW** — Dependencies: `ethers` v6, `viem` (optional); build script with forge |
| `packages/blockchain/test/GrooverRegistry.t.sol` | **NEW** — Foundry unit tests for contract |
| `packages/blockchain/test/BaseConnector.test.ts` | **NEW** — Integration tests with local anvil |
| `packages/marketplace/src/index.ts` | Swap `Map` usage to `CacheLayer` (DI or env toggle); add `chainConfig` to `registerPlugin` |
| `packages/marketplace/src/mcp-server.ts` | Initialize `CacheLayer` on boot if chain configured |
| `packages/marketplace/src/index.test.ts` | Add cache-hit, cache-miss, write-through tests |
| `ARCHITECTURE.md` | Add onchain + cache layer to tree diagram |
| `README.md` | Document Base integration |

### Enhancement 3 — Periodic Reverification + Key Expiry

| File | Change |
|---|---|
| `packages/marketplace/src/index.ts` | Add `status`, `expiresAt`, `lastVerifiedAt` to `PluginRecord`; set 24h TTL in `registerPlugin`; implement `renewPlugin()`; export `sweepExpired()` |
| `packages/marketplace/src/expiry-sweeper.ts` | **NEW** — `sweepExpired()` + `startSweeper()` with grace period logic |
| `packages/marketplace/src/mcp-server.ts` | Add `renew_plugin` tool handler; start sweeper on boot (if enabled) |
| `packages/marketplace/src/index.test.ts` | Add tests: de/register → 24h expiry; renew extends; sweeper grace/expiry |
| `docs/mcp-servers-index.md` | Note `renew_plugin` as exposed tool |
| `packages/chrono/src/index.ts` | Optionally wire `computeTemporalResonance` into reputation decay formula |

### Total: ~18 files (7 new, 11 modified)

---

## Appendix: Data Flow Diagrams

### E1 + E3 Combined Registration Flow

```
  Agent (ed25519)                Marketplace MCP                  Cache Layer                Base Chain (E2 opt)
       │                              │                              │                           │
       │ generateKeyPair()            │                              │                           │
       │ signPayload()                │                              │                           │
       │                              │                              │                           │
       │──── registerPlugin ─────────►│                              │                           │
       │   { pubkey(PEM),             │                              │                           │
       │     payload,                 │                              │                           │
       │     signature,               │                              │                           │
       │     metadata }               │                              │                           │
       │                              │                              │                           │
       │                              │── verifyWithPublic() ──┐    │                           │
       │                              │  (E1: PoP check)       │    │                           │
       │                              │◄─ PASS ────────────────┘    │                           │
       │                              │                              │                           │
       │                              │── generateDID()              │                           │
       │                              │── generateApiKey()           │                           │
       │                              │── { expiresAt: now+24h }     │                           │
       │                              │── status: 'active'           │                           │
       │                              │                              │                           │
       │                              │── set(did, record) ─────────►│                           │
       │                              │                              │── registerAgent() ────────►│
       │                              │                              │◄─ tx receipt ──────────────│
       │                              │                              │ (E2: write-through)        │
       │                              │                              │                           │
       │◄── { did, apiKey, ──────────│                              │                           │
       │      expiresAt, status }     │                              │                           │
       │                              │                              │                           │

  [24 hours later]

       │                              │                              │                           │
       │                              │── sweepExpired() ──────────►│                           │
       │                              │   (every 5 min)              │─ query chain ────────────►│
       │                              │                              │◄─ record ─────────────────│
       │                              │                              │                           │
       │                              │   active → grace             │                           │
       │                              │   rep -= 0.1                 │                           │
       │                              │                              │                           │
       │──── renewPlugin ────────────►│                              │                           │
       │   { did, pubkey,             │                              │                           │
       │     payload, signature }     │                              │                           │
       │                              │── verifyWithPublic()         │                           │
       │                              │── extend 24h                 │                           │
       │                              │── rotate apiKey              │                           │
       │                              │── status → active            │                           │
       │                              │                              │                           │
       │                              │── set(did, updated) ────────►│                           │
       │                              │                              │── renewAgent() ───────────►│
       │                              │                              │◄─ tx receipt ──────────────│
       │                              │                              │                           │
       │◄── { apiKey: new, ──────────│                              │                           │
       │      expiresAt, status }     │                              │                           │
```

### E1 Backward Compat (HMAC Fallback)

```
  Legacy Agent                     Marketplace MCP
       │                              │
       │──── registerPlugin ─────────►│
       │   { pubkey(hex),             │
       │     payload,                 │
       │     metadata }               │
       │    (no signature)            │
       │                              │
       │                              │── isPEM(pubkey)? NO
       │                              │── signature provided? NO
       │                              │── bindCrypto(pubkeyHex, payload)  ← HMAC
       │                              │── generateDID(), generateApiKey()
       │                              │── { expiresAt: now+24h }  (E3 applies too)
       │                              │
       │◄── { did, apiKey, ──────────│
       │      expiresAt, status }     │
```

---

*End of document. All changes governed by the Universal Development Codex via Dynamo. Governance precedes action.*
