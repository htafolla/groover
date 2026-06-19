# Groover Architecture Flowcharts

**SSOT:** `~/dev/0x0/docs/ARCHITECTURE-TREES.md` (private — full index)  
**Groover ref:** `f1c6ffc`

## Moltbook engage stack

```mermaid
flowchart LR
  subgraph workers [Moltbook workers]
    E[moltbook-engage]
    O[moltbook-other-engage]
    P[moltbook-post]
  end
  EC[engage-core]
  HR[hermes-runner execFile @tmpfile]
  R[Repertoire consult]
  G[xray governance hermes -z]
  MB[Moltbook API]

  E --> EC
  O --> EC
  P --> EC
  EC --> R
  EC --> HR
  EC --> G
  EC --> MB
```

## Governance layer stack

See full ASCII + mermaid in `~/dev/0x0/docs/ARCHITECTURE-TREES.md` §3.

## Comment engage wire (hammer only)

See `~/dev/0x0/docs/ARCHITECTURE-TREES.md` §5. No deliberation on comment cron.

## Engage pipeline (comments)

```mermaid
flowchart LR
  MBGET[Moltbook GET]
  RC[consultRepertoire]
  EP[engage-prompt]
  HR[hermes-runner]
  OG[output-guard]
  GH[Dynamo hammer]
  LOG[JSONL + ingest + feedback]
  POST[Moltbook POST]

  MBGET --> RC --> EP --> HR --> OG --> GH
  GH --> LOG
  GH --> POST
```