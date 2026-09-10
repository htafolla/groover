# Groover Identity NFT — Tech Spec for chrono-warp-drive

**Audience:** chrono-warp-drive (Dynamo) agent. You have Foundry, OpenZeppelin, Base RPC, and the live Vortex mint. Copy that **pattern**, not the Vortex product. Launch a **new** collection **for Groover**.

**Spelling:** repo is `htafolla/chrono-warp-drive` (chrono, not chronos). Groover is `htafolla/groover`. Do **not** put this in `0xray`. Do **not** reuse VRTX.

---

## 1. Mission

Ship a Groover-owned ERC-721 on Base that mints a **1/1 for any identified agent** (`did:groover:…`).

- Groover is the minter (Railway git box).
- 0xray mill is the **first trait pack** (`pack = "0xray-suit"`), not the collection.
- Dynamo Vortex stays Dynamo. This contract does **not** call `TemporalContainerRegistry`.

You: author + test + deploy Sepolia then Base, grant `MINTER_ROLE`, hand ABI + addresses to Groover. Stop. Do not wire Groover MCP. Do not build the image compositor. Do not touch mill.

---

## 2. What to copy (chrono-warp-drive)

| Source | Use |
|--------|-----|
| `contracts/VortexTokenV41.sol` | ERC-721Enumerable + AccessControl + `MINTER_ROLE` + 1/1 mapping + on-chain `tokenURI` (Base64 JSON) |
| `contracts/script/Deploy.s.sol` | Broadcast deploy skeleton |
| `contracts/foundry.toml` | `solc 0.8.28`, `evm cancun`, `via_ir`, OZ remappings, `base` / `base_sepolia` RPC + etherscan |
| `contracts/lib/openzeppelin-contracts` | Already vendored — do not re-fetch a different OZ major |
| `contracts/test/TemporalContainer.t.sol` | Test style only |

**Do not copy into the new contract**

- `TemporalContainerRegistry` / `getContainer`
- 7D / TMO / solar structs as required mint args
- `mintForDonation` / payable / treasury (Groover mint is role-gated, not ETH-claim)
- `autoMintVortex` on `/govern_with_solar`
- Image host `mcp-production-80e2.up.railway.app/vortex/token-image/`
- Name `"Dynamo Vortex"` / symbol `VRTX`

**Do not touch live**

| Piece | Address | Chain |
|-------|---------|-------|
| TemporalContainerRegistry | `0xCB418F081D4fDAD6B2b17027294865B26cb26855` | Base 8453 |
| VortexToken (VRTX) | `0x7E410f102Cc7320fd8B9601637f5A67AfDF40cF9` | Base 8453 |

Leave those running.

---

## 3. Product rules (locked)

1. **Organ:** Groover identity mint. Any agent with a Groover DID may receive a token. 0xray is impl #1 (`pack`).
2. **Uniqueness (on-chain, always):** one token per `(did, dna)`. `bytes32 id = keccak256(abi.encode(did, dna))`. Second mint of the same pair **reverts**.
3. **Not** one token per mill recipe. Two agents fastening the same overlay each get a token. Same DID + same DNA cannot.
4. **Variant:** `uint8 variant` with `variant < MAX_VARIANT`. `MAX_VARIANT = 16`. Class look comes from DNA/pack off-chain; variant is the wearer slot `0..15`.
5. **Images:** contract stores `tokenURI` image URL pointing at **Groover Railway**, not Dynamo:

   `https://registry-production-e2c4.up.railway.app/identity/token-image/{tokenId}`

   Compositor is Groover’s job later. You only need a stable URL shape in `tokenURI`.
6. **Citation (optional):** `bytes32 dynamoCitation`. Pass `bytes32(0)` if none. Never `require` a registry lookup.
7. **Mint path:** `onlyRole(MINTER_ROLE)`. No public mint. Groover MCP will call this after PoA (and, for pack `0xray-suit`, after mill inspect attestation — Groover, not this contract).
8. **Keys:** minter key lives on Groover Railway. Not mill. Not 0xray. Not Dynamo ambient daemon.

---

## 4. Contract spec

**File (in chrono-warp-drive):** `contracts/GrooverIdentityToken.sol`

```text
Name:   Groover Identity
Symbol: GRVR
```

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract GrooverIdentityToken is ERC721Enumerable, AccessControl {
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint8   public constant MAX_VARIANT = 16;
    uint8   public constant MAX_LEVEL = 4; // 0 Dissonant .. 3 Celestial
    string  public constant IMAGE_BASE =
        "https://registry-production-e2c4.up.railway.app/identity/token-image/";

    struct TokenData {
        string  did;             // did:groover:<16 hex>
        bytes32 dna;             // keccak256 of canonical pack DNA
        string  pack;            // "0xray-suit" | "groover-identity" | future
        uint8   variant;         // 0 .. MAX_VARIANT-1
        bytes32 dynamoCitation;  // optional; bytes32(0) if none
        uint8   level;           // 0 .. MAX_LEVEL-1 (OpenSea "Level")
        uint256 mintedAt;
    }

    uint256 private _nextTokenId; // 1-based
    mapping(uint256 => TokenData) private _data;
    mapping(bytes32 => uint256)   private _idToToken; // identityKey => tokenId

    event IdentityMinted(
        uint256 indexed tokenId,
        bytes32 indexed identityKey,
        address indexed to,
        string did,
        string pack,
        uint8 variant
    );

    error AlreadyMinted(bytes32 identityKey);
    error InvalidDid();
    error InvalidPack();
    error InvalidVariant(uint8 variant);
    error ZeroAddress();

    constructor(address admin, address minter)
        ERC721("Groover Identity", "GRVR")
    {
        if (admin == address(0) || minter == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    function identityKey(string calldata did, bytes32 dna) public pure returns (bytes32) {
        return keccak256(abi.encode(did, dna));
    }

    function mint(
        address to,
        string  calldata did,
        bytes32 dna,
        string  calldata pack,
        uint8   variant,
        bytes32 dynamoCitation,
        uint8   level
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        if (bytes(did).length < 20) revert InvalidDid(); // "did:groover:" is 13; require prefix+hex
        if (bytes(pack).length == 0 || bytes(pack).length > 64) revert InvalidPack();
        if (variant >= MAX_VARIANT) revert InvalidVariant(variant);

        bytes32 key = identityKey(did, dna);
        if (_idToToken[key] != 0) revert AlreadyMinted(key);

        tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        _data[tokenId] = TokenData({
            did: did,
            dna: dna,
            pack: pack,
            variant: variant,
            dynamoCitation: dynamoCitation,
            level: level,
            mintedAt: block.timestamp
        });
        _idToToken[key] = tokenId;
        emit IdentityMinted(tokenId, key, to, did, pack, variant);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory);
    function getTokenData(uint256 tokenId) external view returns (TokenData memory);
    function tokenByIdentity(string calldata did, bytes32 dna) external view returns (uint256);
    function minted(string calldata did, bytes32 dna) external view returns (bool);
}
```

### `tokenURI` JSON (on-chain, Base64)

Mirror V41’s `data:application/json;base64,` pattern. Exact fields:

```json
{
  "name": "Groover Identity #<tokenId>",
  "description": "1/1 identity mark for <did>. Pack <pack>, variant <variant>.",
  "image": "https://registry-production-e2c4.up.railway.app/identity/token-image/<tokenId>",
  "external_url": "https://registry-production-e2c4.up.railway.app",
  "attributes": [
    { "trait_type": "DID", "value": "<did>" },
    { "trait_type": "Pack", "value": "<pack>" },
    { "trait_type": "Variant", "value": "<variant as decimal>" },
    { "trait_type": "Level", "value": "Dissonant|Unstable|Resonant|Celestial" },
    { "trait_type": "DNA", "value": "<dna 0x-hex>" },
    { "trait_type": "Dynamo citation", "value": "<dynamoCitation 0x-hex or none>" },
    { "display_type": "date", "trait_type": "Minted", "value": <mintedAt * 1000> }
  ]
}
```

Escape DID/pack for JSON (no raw quotes). Same string-concat discipline as `VortexTokenV41.tokenURI`.

### DID check

Require `bytes(did).length >= 25` and first 13 bytes equal `did:groover:`. Do not parse hex on-chain beyond length.

### Packs (document in natspec; do not enum on-chain)

| `pack` | Who | DNA |
|--------|-----|-----|
| `groover-identity` | any Groover DID, no mill | `keccak256(did)` or Groover-chosen canonical bytes |
| `0xray-suit` | mill inspect-green | `keccak256` of canonical `foundry-inventory.json` **without** `mintedAt` |

Contract accepts any non-empty pack string ≤ 64 bytes. Groover MCP will whitelist.

---

## 5. Deploy

**New script:** `contracts/script/DeployGrooverIdentity.s.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../GrooverIdentityToken.sol";

contract DeployGrooverIdentity is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address minter = vm.envAddress("GROOVER_MINTER"); // Railway hot wallet; may equal deployer for sep
        vm.startBroadcast(pk);
        GrooverIdentityToken token = new GrooverIdentityToken(vm.addr(pk), minter);
        vm.stopBroadcast();
    }
}
```

### Env (chrono-warp-drive `contracts/.env` — do not commit)

```
DEPLOYER_PRIVATE_KEY=
GROOVER_MINTER=                 # Groover Railway signer; sep may equal deployer
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=
```

`foundry.toml` already has `[rpc_endpoints] base` / `base_sepolia` and `[etherscan]`. Do not add a third chain.

### Commands

```bash
cd contracts
forge build
forge test --match-contract GrooverIdentityTokenTest -vv

# Sepolia first
forge script script/DeployGrooverIdentity.s.sol \
  --rpc-url base_sepolia --broadcast --verify

# After Groover confirms minter + a test mint:
forge script script/DeployGrooverIdentity.s.sol \
  --rpc-url base --broadcast --verify
```

Admin = deployer EOA. Minter = `GROOVER_MINTER`. If they differ, verify `hasRole(MINTER_ROLE, GROOVER_MINTER)` on-chain before handoff.

---

## 6. Tests (`contracts/test/GrooverIdentityToken.t.sol`)

Must fail the forge run if any of these miss:

| Test | Assert |
|------|--------|
| `mint_assigns_token_and_emits` | tokenId 1, owner `to`, event fields |
| `mint_same_did_dna_reverts` | `AlreadyMinted` |
| `mint_same_dna_different_did_ok` | two tokens |
| `mint_same_did_different_dna_ok` | two tokens |
| `mint_variant_16_reverts` | `InvalidVariant` |
| `mint_variant_15_ok` | max legal |
| `mint_bad_did_reverts` | empty / missing `did:groover:` prefix |
| `mint_empty_pack_reverts` | `InvalidPack` |
| `mint_non_minter_reverts` | AccessControl |
| `tokenURI_contains_did_pack_image_host` | substring `did:groover:`, `0xray-suit`, `registry-production-e2c4.up.railway.app/identity/token-image/` |
| `tokenByIdentity_roundtrip` | key → tokenId → getTokenData |
| `supportsInterface_erc721` | ERC721 + AccessControl |

No tests against the live VRTX address.

---

## 7. Out of scope (you will be wrong if you do these)

- Groover MCP `mint_suit` / Railway image route / mill inspect attestation
- 0xray mill changes, 8th MCP, `foundry-inventory` in this repo
- Migrating or wrapping VRTX
- `mintForDonation`
- Auto-mint from Dynamo govern
- `railway link` to usmail-ai (Groover’s box is the **other** Railway account; git push `htafolla/groover` is their deploy path — not yours)
- `release:major` on 0xray

---

## 8. Handoff to Groover (required output)

Write `docs/GROOVER-IDENTITY-NFT-HANDOFF.md` in chrono-warp-drive (or paste in the PR):

```text
network:          base-sepolia | base
chainId:          84532 | 8453
contract:         GrooverIdentityToken
name / symbol:    Groover Identity / GRVR
address:          0x…
admin:            0x…
minter:           0x…          # GROOVER_MINTER
MAX_VARIANT:      16
identityKey:      keccak256(abi.encode(did, dna))
imageBase:        https://registry-production-e2c4.up.railway.app/identity/token-image/
explorer:         https://sepolia.basescan.org/address/0x…  (or basescan.org)
abi:              contracts/out/GrooverIdentityToken.sol/GrooverIdentityToken.json
tx deploy:        0x…
forge:            forge script script/DeployGrooverIdentity.s.sol --rpc-url base_sepolia --broadcast --verify
```

Also copy that ABI JSON into a follow-up on `htafolla/groover` at `packages/identity/abi/GrooverIdentityToken.json` **only if** you have write access; otherwise attach the file on the handoff PR and stop.

---

## 9. Acceptance

Sepolia is done when:

1. `forge test --match-contract GrooverIdentityTokenTest` green
2. Contract verified on Sepolia Basescan
3. `MINTER_ROLE` holds on `GROOVER_MINTER`
4. A single forge/cast mint with `did:groover:test` + random dna succeeds; a second identical mint reverts `AlreadyMinted`
5. `tokenURI(1)` returns JSON whose `image` host is Groover Railway, **not** `mcp-production-80e2`
6. VRTX and TemporalContainerRegistry unmodified (same bytecode/address)

Base mainnet only after Groover says the minter key on Railway is the same `GROOVER_MINTER` you granted.

---

## 10. Context for the other agent (do not implement)

Groover later: `mint_suit` MCP, DNA from mill inventory (drop `mintedAt`) or from DID for pack `groover-identity`, variant = `hash(did, dna) % 16`, inspect attestation for `0xray-suit` only. 0xray mill stays receipt-only. Dynamo may pass `dynamoCitation` as optional bytes32.

This spec is the contract + launch only.
