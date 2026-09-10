# GRVR Identity Image Compositor — SVG uniqueness

**Status:** compositor is the drawing. Live v2 still serves it at `IMAGE_BASE + tokenId`.
v3 (pending deploy) stores the same SVG in `tokenURI.image` as a data URI. Not Imagine.

**Split:**

| Layer | What it holds |
|---|---|
| Chain v3 (`0x6F955cA0…`) | Recipe + `imageSvg`. `tokenURI.image` is `data:image/svg+xml;base64,…`. `IMAGE_BASE` is `external_url`. |
| Chain v2 (`0x7b184bf7…`) | Superseded. On-chain JSON recipe + `image` URL. Tokens 1–2 stay here. |
| `IMAGE_BASE` | `https://registry-production-e2c4.up.railway.app/identity/token-image/` (string frozen). |
| Railway | `GET /identity/token-image/{tokenId}` → `getTokenData` → `composeIdentitySvg`. |

Live v3: `0x6F955cA006E2FE951750cac25372e098D6E89743`. v2 `0x7b184bf7…` superseded. Sepolia v3 `0x0CEb73b0…`. See `docs/GRVR-MINT.md`.

Scene: front-on headless collar. Visor is the face (four meshes, no brim/fedora). Torso lights against the bay. MILL/JOB/INSPECT/CONSTITUTION is a collar transponder mark, not a stamp on a cap.

---

## 1. Chain vs render

`tokenURI` is Base64 JSON (`name`, `description`, `image`, `external_url`, attributes).
v2: `image` is `IMAGE_BASE + tokenId` (Railway). v3: `image` is on-chain SVG data URI; `external_url` is `IMAGE_BASE + tokenId`.

Render input is `TokenView` (`packages/identity/src/compositor.ts`): `tokenId`, `did`, `pack`, `variant`, `dna`.
Loaded by `loadGrvrTokenView` from `getTokenData`. Citation stays in the JSON recipe; it is not painted.

**Out of the picture (off-chain, not in `TokenView`):** mill job plates, suit state (`fastened` / `overlay` / `costume`), mill job line. Inventory is not on-chain; class look comes from `pack`.

Trait math (unchanged): `hat = HATS[variant >> 2]`, `colorway = COLORWAYS[variant & 3]`, variant `0..15`.

| Hats (visor meshes) | Colorways (full palettes) |
|---|---|
| `mill-cap`, `constitution-visor`, `job-helm`, `inspect-visor` | `mill-cyan`, `inspect-amber`, `groover-violet`, `overlay-steel` |

`PALETTES` already paint `bg` / `accent` / `plate` / `ink` / `dim`. Colorway is the palette, not a post-tint.

---

## 2. Shipped route (keep)

| Piece | File | Behavior |
|---|---|---|
| Renderer | `packages/identity/src/compositor.ts` | `composeIdentitySvg(view)` — `image/svg+xml`, not Imagine |
| HTTP | `packages/marketplace/src/mcp-server.ts` | `GET /identity/token-image/{id}` → `renderIdentityTokenImage`; 200 `image/svg+xml`, `max-age=3600`, CORS `*` |
| Loader | `packages/identity/src/grvr-mint.ts` | `parseTokenIdParam` (digits, reject empty/`0`) → 400 `invalid tokenId`; `getTokenData` miss → 404 `token not minted` |
| DNA | `suit-dna.ts`, `packs/*.ts` | `groover-identity` = `keccak256(did)`; `0xray-suit` = `keccak256(canonical inventory − mintedAt/dna)` + `inspect.ok`; `identityKey = keccak256(abi.encode(did, dna))`; `variantFromKey = key % 16` |

No `sharp`. No `compositor-png`. No `assets/layers/*.png`. Identity `package.json` stays viem + hashes.

If Railway `GRVR_*` still points at Sepolia, `/1` is the wrong collection. Flip env per `docs/GRVR-MINT.md`. Code defaults are mainnet.

---

## 3. Target model — unique SVG meshes

Keep the URL, `TokenView`, and 16-look variant. Replace schematic primitives with **distinct SVG meshes**. Output is still a tiny SVG string (`<12KB`), `viewBox` so it stays sharp at any marketplace scale. Not a 1024 PNG plate. Not a per-mint Imagine call.

### 3.1 Scene (back → front), one SVG

| # | Group | Driven by | Rule |
|---|---|---|---|
| 0 | Backdrop | colorway palette `bg` / `bay` | High-contrast bay. Plate fills must not equal bay (inspect-amber plate `#d4a03a` on bay `#1a1208`). |
| 1 | Visor mesh (the face) | `hat` | **Four unique visor meshes**, ymax ≤ 184. No brim. No fedora. Distinct path topology. |
| 2 | Collar | `hat` banner | Headless neck ring. Transponder mark: `MILL` / `CONSTITUTION` / `JOB` / `INSPECT`. Not stamped on a cap. |
| 3 | Chassis (torso) | `pack` | **Two unique chassis** below the collar, ymin ≥ 224. `groover-identity` hex-gem ≠ `0xray-suit` ribbed. Plate `GRVR` / `EXO`. |
| 4 | Cores | `pack` | **MILL + INSPECT only on `0xray-suit`**. `groover-identity`: none. |
| 5 | HUD | `TokenView` | Line 1 `#${tokenId} ${pack}` (+ Level when set); line 2 `${did} · ${dna slice} · v${variant}`. XML-escape. Compact (no control chars) for on-chain mint. |

Paint every mesh from the colorway palette. Do not raster-tint.

**Uniqueness:** ledger 1/1 is `(did, dna)` on-chain. Visual class is combinatorial: 4 visor meshes × 2 chassis × 4 palettes = 32 large-area looks. HUD (and dna in the recipe) separates same-class tokens. Two `0xray-suit` DIDs with the same inventory share dna and differ in HUD.

### 3.2 Determinism

Same `TokenView` → same SVG bytes. No `Math.random`, no `Date.now`, no network, no Imagine at render. `composeIdentitySvg` stays sync.

### 3.3 Encoding

- `<?xml …?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" …>` (width/height 512 is fine; scale via viewBox).
- UTF-8 string, `Content-Type: image/svg+xml`.
- Byte length **< 12KB**. Looks sharp at any scale because it is vectors, not a 1024 PNG.
- `data-pack`, `data-variant`, `data-hat`, `data-colorway` attributes stay.

---

## 4. Files

| File | Action |
|---|---|
| `packages/identity/src/compositor.ts` | Unique visor meshes, unique pack chassis, hat banner, palettes, cores-on-suit. Keep `composeIdentitySvg` / `TokenView` / `traitsFromVariant`. |
| `packages/identity/src/compositor.test.ts` | 16 looks; 4 distinct hat geometries; 2 distinct chassis; cores only on `0xray-suit`; banner-from-hat; determinism + XML escape; size < 12KB. |
| `packages/identity/src/grvr-mint.ts` | **Untouched** (already SVG from `getTokenData`). |
| `packages/marketplace/src/mcp-server.ts` | **Untouched** (`image/svg+xml`). |
| `*.sol` / groover `contracts/` | **Forbidden in groover.** v3 `imageSvg` lives in chrono-warp-drive. |

Dropped (do not build): `compositor-png.ts`, pinned `sharp`, 1024 PNG plates, SHA256SUMS art pack, per-mint Imagine, `image/png` route flip.

---

## 5. Acceptance

- [CI] `composeIdentitySvg` byte-identical on two calls; XML-escapes DID/pack; no raw `<script>`.
- [CI] Variants `0..15` → 16 `hat/colorway` pairs; `traitsFromVariant(16)` throws.
- [CI] Four hats produce four different visor path sets (`data-hat` + geometry). Two packs produce two different chassis (`id="chassis"` paths differ; suit has `id="mill-inspect-cores"`, identity does not).
- [CI] Banner text follows hat table in §3.1. Suit is not hard-coded `CONSTITUTION`.
- [CI] Output `< 12000` bytes; starts with `<svg` / XML; `image/svg+xml` wiring in `mcp-http-boundary.test.ts` still holds (`renderIdentityTokenImage`, no GRVR stub).
- [CI] `git diff --stat` has no `*.sol` and no `contracts/`.
- [CI] `package.json` has no `sharp`.

---

## 6. Out of scope

Groover-side Solidity; changing the `IMAGE_BASE` string; `?size` / `?format`; mill inventory / job plates / suit state in `TokenView`; new env vars; changing `traitsFromVariant` / `HATS` / `COLORWAYS`; PNG plates; `sharp`; per-mint Imagine; CDN/auth; new chains. v3 mint ABI is chrono, not this compositor file.
