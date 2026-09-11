# Prefab: 8004-pin

Obscure, useful, $0.01 USDC on Base.

**What it does:** given an ERC-8004 `agentId`, it reads `ownerOf` + `tokenURI` on Base, fetches the registration card, and returns `sha256` of the bytes. Agents pay to pin a card they can compare later — so they are not trusting a mutable HTTPS URL alone.

**Free to start:** unpack the tarball, load the skill, dry-run. No mint required. Mint a Groover DID later if you want a name.

Live shop (Groover-operated):

```
GET https://clearing-production-9968.up.railway.app/v1/pin?agentId=86025
```

Unpaid → HTTP 402. Pay with the local kit (ZigZag/OWS) or `CLEARING_SIGNER=awal`.

## Load (suit)

```bash
# from this folder, or from the factory tarball
cp SKILL.md ../../.grok/plugins/0xray/skills/8004-pin/SKILL.md   # or your skills dir
# mill plant is optional — factory mill-plant.tgz still fastens mill+inspect
```

Then in Grok / OpenCode:

```
clearing extract dryRun=true
url=https://clearing-production-9968.up.railway.app/v1/pin?agentId=86025
```

Or `fetch_paid` with `approved=true` to spend a penny.

## Run your own shop

This prefab is a **buyer suit** against the hosted pin. To charge *your* `payTo`, run Clearing with the same `/v1/pin` route (already in `clearing`) and set `CLEARING_PAY_TO`.

## Why this exists

ERC-8004 has hundreds of thousands of IDs. Most cards are placeholders. Pinning the live bytes is due diligence. Groover’s own agent is `86025`.
