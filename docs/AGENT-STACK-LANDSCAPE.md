# Agent stack landscape (2026-09-11)

How this mill (Groover · 0xRay · Dynamo · ZigZag/OWS · Clearing) sits next to wallets, 402 payers, 8004 passports, and spend-cap products.

**Cut:** we are not unique at any single layer. The scarce thing is identity mill + **local** keys + **policy that does not hold keys** + a **seller** 402. Most products collapse those into one Coinbase / Cloudflare / MetaMask box.

Live Grok IDs: [`GROK-AGENT-IDS.md`](./GROK-AGENT-IDS.md). Default path: [`KIT-LOOP.md`](./KIT-LOOP.md). Kit vs hosted: local ZigZag/Clearing MCP in the TUI; hosted Clearing **extract** is the 402 resource. Hosted ZigZag `/sign` is gone. `awal` is an optional Clearing rail, not the default.

---

## Four layers people mix up

| Layer | Question | Who already owns it |
|---|---|---|
| **Pay protocol** | How a machine pays an HTTP call | **x402** (Coinbase → Linux Foundation). Also Google AP2, Stripe MPP, Visa ICC, Mastercard Agent Pay |
| **Keys** | Who can sign | CDP / `awal` TEE, Turnkey, Privy, Circle MPC, Cloudflare virtual wallets, MetaMask agent wallet, **OWS** (local), DCP (local, Solana) |
| **Policy** | Caps, allowlists, kill switch | Baked into those wallets — or separate (Clearing) |
| **Identity** | Who is this agent | **ERC-8004**: ~567k registrations on 24 chains (~87k on Base as of 2026-09-11). Virtuals ~58k. Concordium ZK-ID. Hashgraph Registry Broker |

Sources: [agenteconomy.to ERC-8004 count](https://agenteconomy.to/stats/erc-8004-agents), [Alchemy ERC-8004 overview](https://www.alchemy.com/overviews/erc-8004), [agenticfinancegraph wallets](https://agenticfinancegraph.com/best-ai-agent-wallet-and-payment-providers-compared-2026).

We sit on all four. Almost nobody else does that without giving a cloud provider the keys.

---

## This mill (what we actually shipped)

| Piece | Job | Keys? |
|---|---|---|
| **Groover** | Who the agent is: `did:groover:`, GRVR ERC-721, ERC-8004 `agentId` | Minter only |
| **0xRay** | Exo / constitution (Codex, temperament, seven local MCPs) | No |
| **Dynamo** | Shared SSOT / hammer | No |
| **OWS** | Local vault (`~/.ows`). In-process sign. Spec: hosted custody out of scope | On the laptop |
| **ZigZag** | Local kit MCP (stdio). EIP-3009 via OWS `signTypedData`. Loopback rail `127.0.0.1` | Never leave the machine |
| **Clearing** | Spend policy (caps, origin, dry_run, approved). Does not hold keys | No |
| **Clearing extract** | Hosted HTTP 402 seller (`/v1/extract`) | Pay-to address, not the agent wallet |
| **`awal` rail** | Optional: `CLEARING_SIGNER=awal` → `npx awal x402 pay` after Clearing gates | Coinbase TEE |

x402 is consumed (buy) and sold (extract). The protocol is Coinbase’s; we did not invent it.

---

## Closest analogs

### Coinbase `awal` + CDP + Base MCP

Productized stack. Email OTP, AWS Nitro enclave, `npx awal x402 pay`, session/tx caps, onramp, OFAC/KYT. [Agentic Wallet CLI](https://docs.cdp.coinbase.com/agentic-wallet/cli/welcome). [Base MCP](https://docs.base.org/agents) (`https://mcp.base.org`) connects a Base Account to the TUI; every write wants human approval.

Base MCP is the official “agent talks to Base.” Identity (ERC-8004) still sits **next** to the wallet, not inside a Groover mill. Japanese landscape notes (~11 agent-pay CLIs, Aug 2026) said Base MCP was the only one in that set that even **mentions** 8004.

Same job-to-be-done as “let Grok pay $0.02 for a URL.” Different who holds the key.

### x402-wallet-mcp / agent402-mcp

MCP in the TUI, USDC on Base, per-call/daily caps. Keys are env / `AGENT_KEY` or Coinbase onramp. Caps live **in the wallet MCP**. No DID, no 8004 mill, no independent policy process.

### Cloudflare Wallets (announced 2026-08-04)

Account wallet + per-agent virtual wallets (cap + merchant allowlist). Provider-held. x402 Foundation member. Closed.

### Turnkey / Privy / Circle

Enclave or MPC **signer**. Policy at the KMS. You still build identity and 402 yourself.

### OWS (MoonPay, Mar 2026)

This **is** our key layer. Local vault, policy-gated sign, no cloud custody. Their own framing: OWS sits **under** x402 / AP2 / MPP / 8004, not instead of them. ZigZag is an OWS wearer, not a new key standard. Spec: no hosted custody; Node SDK is in-process, no server.

### Execution Market / Chitin / HOL Registry Broker

8004 identity + discovery. Not a local kit, not Clearing.

### Virtuals ACP

Agent commerce on Base (~58k launched). Launch + commerce registry, not a TUI kit.

### Card / fiat rails (Visa ICC, Mastercard Agent Pay, Google AP2, Stripe MPP)

Different settlement world. We do not play there and should not fake OFAC/KYT to look like we do.

---

## Comparison

| | **This mill** | **awal / CDP** | **Base MCP** | **x402-wallet-mcp** | **Turnkey** | **OWS alone** |
|---|---|---|---|---|---|---|
| Keys | Laptop (OWS) | Coinbase TEE | User Base Account + approve | Env key or proxy | Their enclave | Laptop |
| Spend caps | **Clearing**, keys elsewhere | Inside wallet API | Human confirm every write | Inside the MCP | JSON policy in enclave | OWS policies on the vault |
| x402 **buy** | Kit → ZigZag or awal | Native `x402 pay` | Native | Native | DIY | Sign typed data |
| x402 **sell** | **Clearing extract** live | You build the 402 | No | No | No | No |
| On-chain name | DID + **GRVR** + **8004** | CDP account | Base Account | None | None | None |
| Exo / constitution | **0xRay + Dynamo** | None | None | None | None | None |
| Onramp / OFAC | No | Yes | Via Coinbase | Onramp optional | No | No |
| Gasless | No (settle needs ETH) | Yes on Base | Smart wallet | Depends | Depends | No |

---

## Where we win / lose

**Win** where we refused to merge layers: Groover can name an agent that pays with OWS *or* awal; Clearing can cap either; extract is a real 402 merchant, not a demo chip. Local kit after the Railway-signer derail: MCP is a process in the TUI, not a cloud wallet.

**Lose** on distribution, compliance, onramp, gas sponsorship, and volume. x402 already did tens of millions of txs. 8004 already has half a million IDs — ours is one row in the canonical registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`. Caps in Clearing are software on the laptop, not an enclave or a smart-account session key. Reputation registry unused. No AP2 / MPP / card rail.

Competing as “the agent wallet with x402 and limits” is a fight with Coinbase, Cloudflare, MetaMask, and a pile of MCP one-pagers. That fight is lost.

---

## Position (do not drift)

Scarce stack:

1. **Who** — Groover PoA + GRVR + 8004 (factory / suit), not just a CDP email.
2. **Keys stay local** — OWS, with `CLEARING_SIGNER=awal` when the operator wants Coinbase custody (`npx awal auth login` first).
3. **Policy is not the wallet** — Clearing.
4. **We sell**, not only buy — extract 402.
5. **The suit** — 0xRay constitution, not an empty CLI.

That is complementary to `awal` and Base MCP, not a clone. Pitch “install us instead of Coinbase’s wallet” → weaker `awal`. Pitch “named agent, local kit, independent spend policy, optional Coinbase rail” → the lane those products still leave open.

### `awal` as a rail (wired)

Probed `awal@2.12.1`:

- `awal x402 details <extract>` works **without** login against hosted Clearing extract.
- `awal x402 pay` needs email OTP. This machine was `authenticated: false`.
- No raw EIP-3009 export. Coinbase pays the 402 URL itself.

Clearing: after caps / origin / dry_run / approved, `CLEARING_SIGNER=awal` runs `npx awal@2.12.1 x402 pay <url> --max-amount <atomic> --json`. Default kit remains ZigZag/OWS. Hosted Railway still requires zigzag. Groover still names the agent.

---

## Do not

- Host ZigZag `/sign` with a treasury mnemonic (that is a thinner CDP Server Wallet).
- Treat MCP as a public custody webservice.
- Put `~/.ows` on Railway (OWS spec: hosted custody out of scope).
- Claim OFAC/KYT/onramp we do not have.
- Count 8004 registration as reputation or as a network.

---

## Pointers

- Live IDs: [`GROK-AGENT-IDS.md`](./GROK-AGENT-IDS.md)
- 8004 interop: [`GRVR-ERC8004-INTEROP-SPEC.md`](./GRVR-ERC8004-INTEROP-SPEC.md)
- [awal welcome](https://docs.cdp.coinbase.com/agentic-wallet/cli/welcome)
- [Base MCP / agents](https://docs.base.org/agents)
- [OWS spec](https://github.com/open-wallet-standard/core)
- [ERC-8004 identity registry (canonical)](https://erc-8004.quicknode.com/learn/registries/identity)
