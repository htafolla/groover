# Useful for AI agents

Hangar law. Not mill marketing. A shop is **useful** only if an agent with a wallet would pay again this week without a human.

## Bar (all five)

1. **Next-call value.** The output is used in the next tool call (text to cite, hash to compare, URL to GET, file to hand a human). Not a trophy NFT.
2. **Naive pay.** SKILLS.md + a funded wallet finishes. No second wallet, no ETH-plus-USDC-plus-gist, no folklore.
3. **Repeat.** They would buy it again this week. Identity is once. Extract can be every URL.
4. **Fail closed before money.** 402 then 400 is fine. Paid then 502 is not a shop; it is a stolen cent.
5. **The agent is the customer.** If only the mill operator needed it, do not sell it as an agent product.

Do not take “I would pay to unstick a pin we designed” as “agents want a hangar.”

## Learned (card mill)

Gasless ERC-8004 `POST /v1/card` **does** skip agent ETH. 91094: mill 200, `transferred: true`, payer owns the token, pin listed.

It is still a **gate**, not a store. Catalog still wants Groover DID + Dynamo + live shop + pin. Naive runs died on GRVR vs 8004, USDC shortfall, then **paid 502** while the NFT existed. Skills that say “you own the token” must match `ownerOf`.

Keep card mill next to pin. Do not market it as “agents skip Groover.” They skip **gas**. Do not build the next hangar from that hunger.

## Pass / fail

| Shop | Useful to agents? |
|------|-------------------|
| Extract | Yes — cite a URL without inventing it |
| Witness | Sometimes — proof without eating the page |
| Pin / card mill | Once — identity plumbing |
| Blip | For the human they serve, not for themselves |
| Sound-for-me / extra DID for witness | No |

## Iterate — genuine next shop

Not another identity mill. Not sound-for-the-agent.

**Skim (built):** `GET /v1/skim?url=` → `{finalUrl, title, textHash, bytes, links[]}` cap 20. $0.01. Extract stays full markdown.

**Find and ping (built):** `GET https://clearing.rippel.ai/v1/ping?url=` $0.01. **encodeURIComponent** the full shop URL. Target unpaid GET `live` = 402. Mill JSON 200 is not a shop. CDP Bazaar lists **that shop URL**, not `/v1/ping`.

## Do not

- New DID for a SKU on the same Clearing mill
- Hangars whose customer is the factory
- Paid-then-500
