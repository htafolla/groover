# AgentUIManifest in Groover

**Reference**: https://github.com/htafolla/agentuimanifest (integrated as of Groover MVP build)

AgentUIManifest provides a declarative JSON schema for MCP agents/plugins to describe **human-facing UIs**. This complements Groover's raw registration + cross-correlation by making discovered plugins usable by humans via nice forms, wizards, chat UIs, etc.

## Why in Groover?

- Groover marketplace (packages/marketplace) handles self-registration with Proof of Autonomy (crypto + Dynamo Hammer via 0xRay MCPs) and intelligent search via @groover/core correlation (semantic + temporal + governance + signals).
- Raw MCP `inputSchema` is LLM-only. AgentUIManifest adds the human layer: `label`, `description`, `fieldType`, validation, display modes.
- Registered plugins can now carry `uiManifest`, which is stored, validated at registration time, surfaced in search results, and factored into correlation scoring (manifest text boosts relevance).

## Groover Usage

### In Registration

```ts
import { registerPlugin } from '@groover/marketplace';
import type { AgentUiManifest } from '@groover/marketplace/agent-ui-manifest';

const manifest: AgentUiManifest = {
  version: '1',
  displayMode: 'form',
  primaryTool: 'analyze_repo',
  fields: [
    {
      id: 'repo',
      label: 'GitHub Repository',
      description: 'Paste a GitHub URL or owner/repo',
      fieldType: 'url',
      placeholder: 'https://github.com/owner/repo',
      validation: { required: true, pattern: '^https://github.com/.+' }
    }
  ],
  resultFormat: 'markdown',
  showPoweredBy: true,
  exampleQueries: ['https://github.com/facebook/react']
};

const record = await registerPlugin({
  pubkey: '...',
  payload: '...',
  metadata: { name: 'my-scanner', ... },
  uiManifest: manifest,
});
```

See `getPluginUiManifest(did)` and `PluginRecord.uiManifest`.

### In Search / Correlation

`searchPlugins(query)` augments the content sent to core correlation with manifest labels, descriptions, exampleQueries, and displayMode. This makes UI-declaring plugins rank higher for relevant human-intent queries.

### Validation

Lightweight built-in validator (`validateAgentUiManifest`) runs on register (per SPEC + Groover codex "fit for purpose"). Full Zod etc. can be added later.

## Spec Alignment

Core types and validation mirror the official SPEC.md (v1.0, fetched via MCP during build):

- Top-level: version, displayMode, primaryTool, fields, resultFormat, wizardSteps, chat, etc.
- Field: id, label, fieldType, validation, conditionalOn...
- FieldTypes: text, textarea, url, number, select, toggle
- DisplayModes: form (primary for MVP), chat, wizard, viewer

See fetched examples: scout-form.json (security scanner), wizard-example.json.

Local copy/adaptation of key excerpts lives alongside this doc and in source.

## Governance

- Groover uses its 0xRay/Dynamo/0xRay-enforcer for all changes (this integration was governed via xray-governance__govern_proposals and passed with high external-dynamo confidence).
- AgentUIManifest's own charter (fetched CHARTER.md): open, RFC via issues, DCO via PRs, maintainer model until 10+ contributors. Groover aligns by treating manifests as first-class governed artifacts in the marketplace registry.

## Future

- Marketplace UI (when built) will use the manifest to auto-render forms.
- Correlation can weight manifest fields higher for "human intent" queries.
- Full client-side validation + conditional rendering in examples.

Integrated surgically into MVP per codex (no over-engineering, prod-ready types + usage in example + registry).

_See also: packages/marketplace/src/agent-ui-manifest.ts, the registration flow, and core ranking._
