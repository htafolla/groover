# GRVR Identity Image Compositor v2 — Rendered Exoskeleton Spec

**Status:** normative build spec for Groover implementing agents (rev 2 — incorporates
independent code-fidelity, architecture, and buildability reviews).
Contract side is done and frozen (`GrooverIdentityToken` on Base mainnet
`0x0abcd80C929Ff2f6c308958B112b7925801750D7`; Sepolia history in
`chrono-warp-drive/docs/GROOVER-IDENTITY-NFT-HANDOFF.md`, which records the same
address, chain 8453, and `identityKey = keccak256(abi.encode(did, dna))` the
off-chain code must match). This spec changes **only** what
`GET /identity/token-image/{tokenId}` returns and the code behind it. No contract
changes. No mint-flow changes except a warm check (§5.5).

**Reference look** (the bar): rendered armored robot, full helmet with dark visor,
visor branding plate plus banner, transparent exoskeleton torso with glowing cores
and circuit conduits (cyan/violet/gold), assembled plate layers with wear, dim
industrial backdrop. Raster/rendered aesthetic — **not** vector line-art.

**Conventions in this doc:** "CURRENT" = behavior in `origin/main @ fc926f2`
(verified by independent review against code). Unmarked MUSTs are normative changes.

---

## 1. Current state (verified)

| Piece | File | Behavior |
|---|---|---|
| Trait model | `packages/identity/src/compositor.ts:28-37` | `traitsFromVariant`: `hat = HATS[variant >> 2]`, `colorway = COLORWAYS[variant & 3]`; `HATS`/`COLORWAYS` tables at `:20-21`; 4×4 = 16 looks; throws `variant must be 0..15` outside range |
| SVG renderer | `packages/identity/src/compositor.ts:82-108` | `composeIdentitySvg(view: TokenView)`: 512×512 flat schematic (hat shapes at `:47-70`, hexagon chassis at `:97`, MILL/INSPECT circles iff `0xray-suit` via `packCores` at `:72-80`, monospace HUD `#<id> <pack>` / `<did> · <dna10> · v<variant>` at `:104-105`). Header comment (`:1-4`): "Closed GRVR trait compositor… Not Imagine." |
| Route | `packages/marketplace/src/mcp-server.ts:489-500` | `GET /identity/token-image/{id}` → `renderIdentityTokenImage`; CURRENT 200 `image/svg+xml` (`max-age=3600`), CORS `*` |
| Renderer | `packages/identity/src/grvr-mint.ts:212-230` | `parseTokenIdParam` (`:170-178`, strips `?…`, keeps digits, rejects empty/`0`) → 400 `'invalid tokenId'`; `loadGrvrTokenView` chain-reads `getTokenData` (`:188-193`) → null → 404 `'token not minted'` |
| DNA model | `packages/identity/src/suit-dna.ts`, `packs/*.ts` | `groover-identity`: `keccak256(did)` (`packs/groover-identity.ts:9-10`); `0xray-suit`: `keccak256(canonical inventory − mintedAt/dna)`, `inspect.ok === true` required (`packs/xray-suit.ts:16-37`); `identityKey = keccak256(abi.encode(string, bytes32))` via viem `encodeAbiParameters` (`suit-dna.ts:29-38`); `variantFromKey = key % 16` (`:40-42`); canonical DID `DID_RE = ^did:groover:[0-9a-fA-F]{16}$` + length 28 (`:14-17`) |
| Defaults (STALE) | `suit-dna.ts:10-12` | `GRVR_DEFAULT_CONTRACT=0xFc644D…` (Sepolia), `GRVR_DEFAULT_CHAIN_ID=84532`, `GRVR_DEFAULT_RPC=https://sepolia.base.org` — flipped to mainnet by §8 |
| Tests | `compositor.test.ts` (16-look set `:17-27`, determinism+escaping `:29-44`, pack cores `:46-54`), `mcp-http-boundary.test.ts:82-86` (asserts `renderIdentityTokenImage` wiring, asserts old `font-size="28">GRVR` stub absent) | Baseline must be green before starting (§9) |

## 2. Live forensics (probed 2026-09-10, motivates §5.6/§7/§8)

1. **`/1` → 200 `image/svg+xml`, 1716 bytes**, schematic content (`#1 0xray-suit`,
   `did:groover:81dd524004f528a0 · 0x7531d70d · v4`). This `(did, pack, variant)` matches
   **none** of the four known Sepolia deployments' token #1 (checked on-chain via
   `getTokenData(1)` on `0xB05227…`, `0x68e4E5…`, `0x862300…`, `0xFc644D…`). Conclusion:
   Railway's `GRVR_CONTRACT` does not track the canonical deployment. Fix = §8
   reconciliation + §5.6 observability (staleness becomes visible, not guessed).
2. **`/2` → 404 `token not minted`** although `0xFc644D…` tokens #2/#3 exist on-chain
   (verified via `getTokenData(2|3)` + `totalSupply() == 3`). Consistent with (1):
   the route reads whatever contract the env points at. Registry-gating itself is
   correct for genuinely unminted ids — but env staleness is user-visible. Same fix.

## 3. Target model v2 (normative)

Keep the URL shape, the `TokenView` pipeline, and the 16-look variant contract.
Replace the schematic SVG with a **deterministic layered raster (PNG)** composition.

### 3.1 Layer stack (back → front), 1024×1024 canvas

| # | Layer | Source | Driven by |
|---|---|---|---|
| 0 | Backdrop: factory bay, dim servers + crane rails | Pre-rendered asset, 3 variants `bay-0.png`, `bay-1.png`, `bay-2.png` | `dna[0] % 3` where `dna[i]` = byte `i` of the 32-byte dna (`parseInt(dna.slice(2+2*i, 4+2*i), 16)`, `dna` is `0x` + 64 hex) |
| 1 | Chassis: exoskeleton torso plates, transparent midriff with circuit conduits | Pre-rendered asset per pack class: `chassis-groover-identity.png`, `chassis-0xray-suit.png`. Future packs add one file + adapter hook; no code change to the stack. Unknown pack → **500** body `unknown pack "<pack-id>"` per §5; never silently substitute | `pack` |
| 2 | Helmet: full helm + dark visor + branding plate + visor banner | Pre-rendered asset per hat, exact mapping: `mill-cap` → `helm-mill-cap.png`, `constitution-visor` → `helm-constitution-visor.png`, `job-helm` → `helm-job-helm.png`, `inspect-visor` → `helm-inspect-visor.png`. Loader throws `UnknownHatError` on missing file; no fallback. Branding plate baked into asset (`0xRay` on suit helms, `GRVR` on identity helms). Banner follows **hat**, never pack: `mill-cap` → `MILL`, `constitution-visor` → `CONSTITUTION`, `job-helm` → `JOB`, `inspect-visor` → `INSPECT`. DejaVu Sans Mono Bold 48px `#FFFFFF`, centered `x=512, y=310`, max width 700 (shrink-to-fit, never wrap). Do not stamp every `0xray-suit` as `CONSTITUTION ON`. Render does not re-gate hats; mill inspect is the gate; compositor trusts on-chain variant | `hat = HATS[variant >> 2]` (existing math, unchanged) |
| 3 | Cores: two named organs on `0xray-suit` only | `0xray-suit`: two fixed nodes in torso box `{x:312, y:380, w:400, h:420}` — left **MILL** (`cx = x + w*0.28`, `cy = y + h*0.48`), right **INSPECT** (`cx = x + w*0.72`, `cy = y + h*0.48`). Each is a blurred circle (`sigma 12`, opacity `0.85`, `blend: 'screen'`; if libvips lacks `screen`, the build-time test fails — do not silently substitute `over`) plus a 2px conduit between them, `#67E8F9`, opacity `0.7`. DNA may jitter radius (`18 + (dna[2] % 8)` px MILL, `18 + (dna[3] % 8)` px INSPECT) and glow, not count or identity. Color = colorway accent: `mill-cyan #3ec8f5`, `inspect-amber #f5b63e`, `groover-violet #9b7dff`, `overlay-steel #7aa0b8`. `groover-identity` (and unknown-but-valid future packs until they declare cores): **no** mill/inspect cores. Never 3–7 DNA-scattered blobs | `pack` selects presence; `dna` jitter only |
| 4 | Wear: scratches/edge highlights, per-stroke alpha ≤ 0.25 | Procedural strokes from the PRNG stream §3.2: count `= [0, 12, 30, 60][variant & 3]`; each stroke length `20 + nextInt(120)` px, width `1 + nextInt(2)` px, `#FFFFFF`, alpha `0.10 + 0.05 * (variant & 3)`, position/angle from sequential `nextInt` calls | PRNG stream only |
| 5 | HUD plate: bottom strip, two lines | SVG text overlay: line1 = `#${tokenId} ${pack}`, line2 = `${did} · 0x${dna.slice(2, 10)} · v${variant}` (`dna` in hex-string form), XML-escaped with existing `xml()` (no stripping — HUD is provenance, escape-only). Geometry: DejaVu Sans Mono 24px `#E8F6FF` on `rgba(0,0,0,0.65)` strip `x=0, y=944, w=1024, h=80`, 16px padding. Job plates, suit state (`fastened`/`overlay`/`costume`), and mill job line are **out**: they live on mill inventory, not `getTokenData` / `TokenView`. Do not imply the painted exo shows mill plates it cannot see | `TokenView` verbatim |
| 6 | Colorway grade: global tint, applied after layers 0–4 and **before** text layers 2-banner/5 | `sharp(base).tint(accentHex).toBuffer()` with the §3.1 accent table; never tint banner/HUD text | `colorway = COLORWAYS[variant & 3]` (existing math, unchanged) |

Assets live in `packages/identity/assets/layers/` (committed PNGs, 1024×1024) plus
`assets/layers/README.md` listing per file: generator model + version, prompt text,
seed, dimensions, and committed SHA256 (byte-regeneration not required; the table
is provenance). `assets/layers/SHA256SUMS` is integrity-checked at startup — fail
loud on mismatch (a bad merge or truncated plate must never silently degrade every
token). Total committed art: 3 bays + 2 chassis + 4 helms = 9 plates; everything
else is deterministic procedure.

**Honest uniqueness note:** ledger-level 1/1 per `(did, dna)` is inherited from the
contract and is real. *Visual* distinctness is combinatorial, not perceptual, until
measured: only 96 coarse buckets (16 variants × 2 packs × 3 bays) drive large-area
structure; dna drives bay/core-glow/wear/tint, not organ count. `groover-identity` dna is
`keccak256(did)` (1:1 with did, fine); `0xray-suit` dna derives from canonical
inventory, so two DIDs sharing an inventory share dna and differ only in HUD text.
§9.1 includes a perceptual gate (median pairwise MAD) so this claim is measured,
not asserted.

### 3.2 Determinism (normative, exact)

- Entropy sources, exhaustive: (a) direct `dna[i]` reads per §3.1 rows 0 (bay) and 3 (core radius jitter);
  (b) the PRNG stream below for wear jitter (§3.1 row 4). **Nothing else.**
  No `Math.random`, no `Date.now`, no network at render time. `dna[11..18]` is
  reserved, not a second seed.
- PRNG: xorshift64\* over BigInt. Normative pseudocode every implementation must match:
  ```
  s = u64be(dna[0..8])            // first 8 dna bytes, big-endian, as BigInt
  if s == 0: s = 0x9E3779B97F4A7C15
  next():                         // returns u64 BigInt
    s ^= s >> 12n
    s ^= s << 25n; s &= 0xFFFFFFFFFFFFFFFFn
    s ^= s >> 27n
    return (s * 0x2545F4914F6CDD1Dn) & 0xFFFFFFFFFFFFFFFFn
  nextInt(n): return Number(next() % BigInt(n))   // n is a small integer
  ```
  JS `number` cannot hold u64 — implementations MUST use BigInt exactly as above.
- Output encoding (normative): pipeline ends with
  `.png({ compressionLevel: 9, adaptiveFiltering: false, force: true, palette: false })`
  and NO `withMetadata` call (sharp's default strips metadata; calling
  `withMetadata({})` would *preserve* input EXIF — inverted and forbidden).
  No text chunks.
- Scope (normative, do not overpromise): byte-identical output is guaranteed **within
  a single pinned toolchain** (locked `sharp` exact version, locked Node base image —
  record libvips + font versions in a startup log line and in `X-GRVR-Renderer`, §5.6).
  Rebuilds that bump libvips/librsvg/fonts may change bytes; the ETag (§5.6) includes
  a renderer code version so caches invalidate correctly.

### 3.3 What is preserved from v1

- `traitsFromVariant` math, `HATS`/`COLORWAYS` tables, `TokenView` shape (imported
  from `./compositor.js`), `composeIdentitySvg` (kept + tested; route no longer calls
  it by default), XML-escaping discipline, pack-cores as two named organs (MILL +
  INSPECT on `0xray-suit`; none on `groover-identity`).

## 4. Render pipeline (normative)

- New module `packages/identity/src/compositor-png.ts` exporting
  `composeIdentityPng(view: TokenView): Promise<Buffer>` (1024×1024 PNG, target ≤ 1 MB)
  plus `InvalidVariantError`, `UnknownPackError`, `UnknownHatError`, `InvalidDidError`,
  `MissingFontError`, `OutputTooLargeError` (all `extends Error`, exported).
  `TokenView` imported from `./compositor.js`.
- Dependency: add `"sharp": "<exact>"` (exact pin, no `^`) to
  `packages/identity/package.json`. Railway Nixpacks-compatible — proven by §9.5
  preview gate. No remote fetch in the render path, ever.
- Fonts: banner/HUD overlays rasterized via sharp's bundled librsvg. On module load,
  run `fc-match "DejaVu Sans Mono"` and throw `MissingFontError("DejaVu Sans Mono")`
  naming the font if absent (no silent face substitution).
- Module-scope caches (required for §9.8 perf budget): decoded layer buffers loaded
  once at startup; `sharp.cache({ memory: 128, files: 20 })` minimum on 512 MB;
  lazy singleton renderer init. Render concurrency cap 4 module-wide: beyond that,
  queue and respond **429** with `Retry-After: 2` (never OOM the box).
- Per-render budget p95 < 1500 ms warm on Railway 512 MB (measured per §9.8).

## 5. Route contract (normative, `mcp-server.ts` + `grvr-mint.ts`)

- `GET /identity/token-image/{tokenId}` parsing tightened: strict
  `^[1-9][0-9]*$` on the id segment (CURRENT strips non-digits, so `abc123` renders
  token 123 — that Hadoop-style leniency ends; anything else → **400**).
- Chain read with error taxonomy (CURRENT lumps everything into 404 — that ends):
  `loadGrvrTokenView` distinguishes viem `ContractFunctionRevertedError`
  (revert/empty → token genuinely unminted → **404** body `token not minted`)
  from transport/timeout/ABI errors → **502** body `upstream unavailable` with
  `Retry-After: 5`. Per-RPC timeout 5 s (violation → 502 path, and the request
  AbortSignal fires 504 per §6 if the full render exceeds 10 s).
- Chain data validated at render: `did` must match canonical RE, `dna` 32-byte hex,
  `variant` 0..15, pack `^[a-z0-9-]+$` and ≤ 64. Malformed chain data → **500**
  (data corruption is loud, never render-or-strip). Unknown pack → **500** body
  `unknown pack "<pack-id>"` (never silently substitute).
- Success → **200 `image/png`**. Bodies: errors are `Content-Type: text/plain;
  charset=utf-8` with exactly the strings above.
- Caching: `Cache-Control: public, max-age=86400` (NO `immutable` — the same URL has
  served different bytes under different `GRVR_CONTRACT` values (§2), and `immutable`
  would pin stale bytes across contract flips). `ETag: sha256hex(contract|chainId|
  tokenId|dna|variant|pack|GRVR_IMAGE_VERSION)` with `GRVR_IMAGE_VERSION = "2"`
  exported from `compositor-png.ts` (bump on any renderer change); honor
  `If-None-Match` → **304**. Keep `Access-Control-Allow-Origin: *`.
- Observability (new, required): **every** image response (200/400/404/500/502/504/304)
  carries `X-GRVR-Contract: <0x-lowercase-40hex>` and `X-GRVR-Chain-Id: <decimal>`
  reflecting the env actually read, plus `X-GRVR-Renderer: sharp-<libvips>+librsvg-<ver>/imgv<GRVR_IMAGE_VERSION>`.
  `renderIdentityTokenImage` return shape becomes
  `{ status: 200|400|404|500|502|504, body: Buffer|string, contentType: string,
  headers: { X-GRVR-Contract, X-GRVR-Chain-Id, X-GRVR-Renderer, Cache-Control?,
  Access-Control-Allow-Origin } }`; `mcp-server.ts` forwards headers verbatim (no logic).
- Warm check (`mint_suit`, the ONLY mint-flow change allowed): after a successful mint,
  in-process `composeIdentityPng(await loadGrvrTokenView(tokenId))` (no HTTP loopback,
  no SSRF surface), retry ≤ 3 with backoff; on total failure emit a structured
  `grvr-image-warm-fail` log + metric but return mint success (never fail a paid mint
  over a picture).

## 6. Robustness (normative)

- `server.timeout = 10_000` on the HTTP server; per-render `AbortSignal.timeout(10000)`;
  on timeout → **504** body `render timeout`. Per-RPC 5 s timeout per §5.
- Banner copy rule (exact order): (1) compute text per §3.1 row 2; (2) strip chars
  outside `[A-Za-z0-9:._\- ]` (empty result → `"GRVR"`); (3) `xml()`-escape. HUD uses
  full `xml()` escape with NO stripping (provenance must be verbatim).
- Output cap: `sharp.resize(1024, 1024, { fit: 'cover' })`; if buffer > 1,048,576 bytes,
  recompress once at `compressionLevel: 9`, then throw `OutputTooLargeError` → 500 if
  still over. No `?size`/`?format` params; unknown query is ignored.

## 7. Files (normative)

| File | Action |
|---|---|
| `packages/identity/src/compositor-png.ts` | **New** — §§3–4 (+ `GRVR_IMAGE_VERSION = "2"`) |
| `packages/identity/src/compositor-png.test.ts` | **New** — §9.1 |
| `packages/identity/assets/layers/*.png` + `README.md` + `SHA256SUMS` | **New** — 9 committed plates (§3.1); README lists per file: generator model+version, prompt, seed, dimensions, SHA256 |
| `packages/identity/src/grvr-mint.ts` | Modify: `renderIdentityTokenImage` (§5 shape/headers/taxonomy), chain-error distinction, warm check, RPC timeout |
| `packages/identity/src/suit-dna.ts` | Modify defaults → mainnet: `GRVR_DEFAULT_CONTRACT=0x0abcd80C929Ff2f6c308958B112b7925801750D7`, `GRVR_DEFAULT_CHAIN_ID=8453`, `GRVR_DEFAULT_RPC=https://mainnet.base.org` |
| `packages/identity/package.json` | Add exact-pinned `sharp` |
| `packages/marketplace/src/mcp-server.ts` | Forward new headers; `server.timeout = 10_000`; image-route per-IP token bucket (60/min, burst 20) + render LRU (100 rendered buffers keyed by ETag input) — rendered-buffer cache + decoded-layer cache per §4 |
| `packages/marketplace/src/mcp-http-boundary.test.ts` | Update: assert PNG wiring (`composeIdentityPng`, `image/png`, `Cache-Control: public, max-age=86400`, CORS `*`, no `immutable`); keep stub rejection |
| `docs/GRVR-MINT.md` | Update Railway env block to mainnet + image section (PNG, headers, ETag, warm check) |
| `packages/identity/src/compositor.ts`, `compositor.test.ts` | **Untouched** (v1 SVG stays tested) |

## 8. Env + ops (normative checklist for the Groover seat)

1. Reconcile `GRVR_CONTRACT` to the canonical deployment **before merging**: the served
   `/1` matches none of the four known Sepolia deployments (§2.1). Canonical target is
   now **mainnet** `0x0abcd80C929Ff2f6c308958B112b7925801750D7` (cutover decided; Sepolia
   is history). Gate: `curl -i $BASE/identity/token-image/1` must return
   `X-GRVR-Contract: 0x0abcd80c929ff2f6c308958b112b7925801750d7` before merge.
   (Fix the pre-existing typo where this checklist said "Jennings" — it means Railway.)
2. Flip to mainnet with the contract cutover: `GRVR_CONTRACT=0x0abcd80C929Ff2f6c308958B112b7925801750D7`,
   `GRVR_CHAIN_ID=8453`, `GRVR_RPC_URL=https://mainnet.base.org` (code defaults in
   `suit-dna.ts` flip in the same PR so fresh checkouts agree with prod).
3. `GRVR_PRIVATE_KEY` stays the **only** signing key (`minterKey()` already rejects
   leftovers; do not add another key var).

## 9. Acceptance (gates; CI = must-pass in PR, MANUAL = Railway-seat gates)

- [CI] 9.1 `npx vitest run packages/identity/src/compositor-png.test.ts` green with
  fixtures `dna = 0x` + bytes `0x01..0x20`, `did = did:groover:0123456789abcdef`,
  `tokenId = '1'`, both packs, variants `0..15`: determinism (`Buffer.equals` on two
  renders), distinctness (pairwise SHA256 of 32 renders all unequal), PNG magic
  `89 50 4E 47 0D 0A 1A 0A` + `sharp.metadata()` width/height `1024`, throws are
  `instanceof InvalidVariantError/UnknownPackError`, perceptual gate (16×16 gray
  via sharp raw, median pairwise mean-absolute-difference ≥ 5).
- [CI] 9.2 Root `npx vitest run` green; boundary test asserts PNG wiring + cache/CORS
  headers (no `immutable`) + stub rejection.
- [CI] 9.3 Golden drift alarm: fixture view (§9.1) renders to checked-in SHA256 in
  `compositor-png.test.ts` (toolchain-scoped: valid under pinned `sharp` + Node 20 CI;
  investigate-on-fail, and any renderer change bumps `GRVR_IMAGE_VERSION` + digest).
- [CI] 9.4 `git diff --stat` shows no `*.sol` and no `contracts/` changes (there is no
  `contracts/` dir in groover; VRTX/registry live in another repo — assert none exist).
- [MANUAL] 9.5 Preview build log has no libvips error; preview `/health` 200.
  PR includes `scripts/probe-image.sh BASE_URL CONTRACT CHAIN KNOWN_MINTED_ID
  UNMINTED_ID` asserting via `curl -i`: known id → 200 `image/png` + matching
  `X-GRVR-Contract`/`X-GRVR-Chain-Id`; `0` → 400; huge unminted id → 404; headers
  present on all three.
- [MANUAL] 9.6 Fresh-mint warm check on mainnet: `mint_suit` for a real DID → image
  200 within 60 s with no manual steps (exact command + 6×10 s poll loop documented
  in the PR).
- [MANUAL] 9.7 Assets README lists per plate: model+version, prompt, seed, dimensions,
  SHA256 matching `SHA256SUMS`.
- [CI] 9.8 Perf: cold vs warm p50/p95 recorded in PR description; warm p95 < 1500 ms
  on Railway 512 MB class (lazy singleton + layer/buffer caches per §4).

## 10. Out of scope (implementing agent will be wrong to do these)

- Per-mint AI image generation calls; new chains; contract changes; mill changes
  (`packages/mill/*` — do not touch); `mint_suit` flow changes beyond the warm check;
  Railway project/account ops; changing the URL shape
  (`/identity/token-image/{tokenId}` is frozen by on-chain metadata); new query params
  (`?size`/`?format`); new deps beyond `sharp`; new env vars; changing
  `traitsFromVariant`/`HATS`/`COLORWAYS`/`TokenView` math; runtime AI calls; CDN/auth
  changes; SVG route removal (`compositor.ts` stays). Warm check is the only mint-flow
  change allowed.
