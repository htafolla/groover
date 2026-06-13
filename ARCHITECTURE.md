# Groover Architecture

## High-Level Overview

```ascii
Groover (Plugin Marketplace + Cross-Correlation)
├── Agent Identity MCP (Verification + Dynamo Hammer)
├── 0xRay MCP Runtime (Execution)
├── Cross-Correlation Engine (Diffuser / zigzag)
└── Temporal/Chrono Layer
```

## Component Tree

```ascii
packages/
├── core/                  # Cross-correlation kernel
├── marketplace/           # Registry + discovery
├── chrono/                # Temporal plugins
├── identity/              # MCP registration hooks
└── examples/
```

Dynamo as ultimate trust hammer with obscurity.

Full details in TECH-SPEC.md