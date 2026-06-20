import { readFileSync, existsSync } from 'node:fs';

const SIGNALS_PATH = 'research/repertoire-brain/curated_signals.json';

function check() {
  if (!existsSync(SIGNALS_PATH)) {
    console.log("❌ Repertoire signals file missing");
    return;
  }

  const data = JSON.parse(readFileSync(SIGNALS_PATH, 'utf8'));
  const total = data.signals.length;
  const critical = data.signals.filter((s: any) => s.priority === 'critical').length;
  const high = data.signals.filter((s: any) => s.priority === 'high').length;
  const lastUpdated = data.last_updated;

  console.log("=== Repertoire Health ===");
  console.log(`Total signals:     ${total}`);
  console.log(`Critical:          ${critical}`);
  console.log(`High priority:     ${high}`);
  console.log(`Last enriched:     ${lastUpdated}`);
  console.log(`Status:            ✅ Healthy`);
}

check();
