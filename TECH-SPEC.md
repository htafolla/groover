# Groover Tech Specification

## Core Tech Stack
- TypeScript / Node.js (monorepo with TurboRepo)
- MCP SDK for agent registration
- Integration with 0xRay MCP runtime
- Dynamo metrics for trust scoring (opaque)
- DID-based agent identity + API key credential issuance

## Key Components
1. Cross-Correlation Engine (from zigzag)
2. Agent Registry
3. Temporal Resonance Hooks (chrono)
4. Identity + Credential Minting

## Assembly Instructions for AI Devs
1. Pull code from source repos
2. Refactor into packages/
3. Implement register_agent MCP tool

Full plan in IMPLEMENTATION-PLAN.md