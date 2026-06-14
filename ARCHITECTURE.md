# Groover Architecture

## High-Level Structure (ASCII Tree)
```
groover/
├── packages/
│   ├── core/                    # Cross-Correlation + Diffuser Engine (from zigzag)
│   ├── registry/                # Agent registry, CLI, search
│   ├── chrono/                  # Temporal Resonance + versioning (from chrono-warp-drive)
│   ├── identity/                # Agent Identity + DID + API key credential issuance
│   └── xray/                    # 0xRay MCP execution & orchestration
├── examples/
│   └── stringray-plugin-consumer/
├── docs/
│   └── mcp-schemas/
└── infra/                       # Railway deployment
```

## Registration & Verification Data Flow
```
Agent (with MCP client)
    ↓ (register_plugin call)
Crypto Binding (pubkey + signature)
    ↓
Dynamic Behavioral Challenge (multi-turn, tool orchestration)
    ↓
Dynamo Signal Submission (solar/alignment/neural metrics)
    ↓
Dynamo Hammer Evaluation (opaque, internal)
        ├── Yes → Mint DID + API key credential + Registry entry + Reputation
        └── Gray/Abuse → "Try again later" + cooldown
```

## Cross-Correlation Engine
Uses patterns from zigzag/Diffuser:
- Semantic similarity (embeddings)
- Temporal resonance (chrono)
- Governance alignment (Dynamo)
- Real-time X/web signals

This creates discoverability and composition for autonomous agents.

Under His authority.