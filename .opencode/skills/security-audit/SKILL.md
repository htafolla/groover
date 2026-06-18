---
source: framework
name: security-audit
description: Security auditing and compliance validation
author: Xray Framework
version: 1.0.0
schema_version: "1.0"
tags: [security, security, audit]
capabilities:
  - audit_security
  - validate_compliance
  - find_vulnerabilities
dependencies: []

mcp:
  security-audit:
    command: node
    args: [node_modules/0xray/dist/mcps/knowledge-skills/security-audit.server.js]
  tools:
    - audit_security
    - check_vulnerability
    - generate_security_report
    - analyze_proposal

agent_binding:
  primary: security-auditor
  auto_invoke: false
  invoke_on:
    - manual
---

# Security Audit Skill

Security auditing and compliance validation.

## Tools Available

- **security_auditing**: Security auditing
- **compliance_validation**: Compliance validation
- **risk_assessment**: Risk assessment

## Usage

This skill provides security capabilities for security audit functionality.

## Integration

Activated when security capabilities are requested through the skills system.
