# Groover Tech Specification

## Core Tech Stack
- TypeScript / Node.js (monorepo with TurboRepo)
- MCP SDK for plugin registration
- Integration with 0xRay MCP runtime
- Dynamo metrics for trust scoring (opaque)
- IPFS + Sui for on-chain attestations

## Key Components
1. Cross-Correlation Engine (from zigzag)
2. Plugin Registry
3. Temporal Resonance Hooks (chrono)

## Assembly Instructions for AI Devs
1. Pull code from source repos
2. Refactor into packages/
3. Implement register_plugin MCP tool

Full plan in IMPLEMENTATION-PLAN.md