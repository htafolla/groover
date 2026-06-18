---
source: framework
name: testing-strategy
description: Design comprehensive testing strategies and optimize test coverage
author: Xray Framework
version: 1.0.0
schema_version: "1.0"
tags: [testing, strategy, coverage, quality]
capabilities:
  - design_strategy
  - optimize_coverage
  - ensure_quality
dependencies: []

mcp:
  testing-strategy:
    command: node
    args: [node_modules/0xray/dist/mcps/knowledge-skills/testing-strategy.server.js]
---

# Testing Strategy Skill

Provides intelligent testing strategy and coverage optimization capabilities.

## Tools Available

- **analyze_test_coverage**: Analyze current test coverage and identify gaps
- **design_test_strategy**: Design comprehensive testing strategy for projects
- **identify_test_gaps**: Identify untested code and recommend test cases
- **optimize_test_coverage**: Analyze and optimize test coverage patterns

## Usage

This skill helps design and optimize testing strategies for:
- Unit testing coverage analysis
- Integration testing planning
- End-to-end testing strategies
- Test coverage optimization
- Testing best practices implementation

## Per-suite triage (autonomy-command rule 3)

After major changes, **do not** run the full test suite first.

```text
1. Identify affected test file(s) from the diff
2. Run ONE suite: npm test -- path/to/focused.test.ts
3. Read ALL failure output — triage root cause
4. Fix → rerun that suite until green
5. Repeat for each affected suite
6. Only then: npm test (full suite gate)
```

Lead dev owns every failure. No "pre-existing" deferrals.