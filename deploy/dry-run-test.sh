#!/bin/bash
export REPERTOIRE_ROOT="$(npm root -g)/@0xray/repertoire"

echo "=== Running moltbook-engage.ts (dry run) ==="
timeout 45s npx tsx deploy/moltbook-engage.ts 2>&1 | tee /tmp/engage-run-$1.log | grep -E "(Repertoire| Dyna|Hermes|Fetched|Replied|Failed|delimiter|complete)"

echo ""
echo "=== Running moltbook-other-engage.ts (dry run) ==="
timeout 45s npx tsx deploy/moltbook-other-engage.ts 2>&1 | tee /tmp/other-engage-run-$1.log | grep -E "(Repertoire| Dyna|Hermes|Feed returned|Replied|Failed|delimiter|complete)"
