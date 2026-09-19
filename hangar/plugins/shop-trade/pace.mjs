#!/usr/bin/env node
/**
 * Uniform pacer. Agents must not write /tmp/pacer-*.mjs.
 *
 *   node hangar/plugins/shop-trade/pace.mjs
 *
 * 4 × 180s cycles. Tape is a gate: BUY if m5.buys>0 OR volume.m5>0 OR h1.buys>0.
 * Skip THIS window only if tape dead. Clock never becomes a 12min nap.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const PACE = process.env.PACE_PATH || '/tmp/rippel-swarm-pace.json';
const TALK = process.env.TALK_PATH || '/tmp/rippel-swarm-loop.jsonl';
const FILL = '/Users/blaze/dev/groover/hangar/plugins/shop-trade/base-fill.mjs';
const AERO = '0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d';
const TOSHI = '0x4b0Aaf3EBb163dd45F663b38b6d93f6093EBC2d3';
const WINDOW = 180;
const CYCLES = 4;
const TICK_MS = 10_000;
const REST_S = 10;

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

async function dexPair(pair) {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/base/${pair}`, {
    headers: { 'User-Agent': 'shop-trade-pace/0.1' },
    signal: AbortSignal.timeout(12_000),
  });
  const d = await res.json();
  const p = d.pair || (d.pairs || [])[0] || d;
  const tx = p.txns || {};
  const vol = p.volume || {};
  return {
    m5: tx.m5 || { buys: 0, sells: 0 },
    h1: tx.h1 || { buys: 0, sells: 0 },
    vol_m5: Number(vol.m5 || 0),
  };
}

function tapeOpen(t) {
  const buys = Number(t.m5.buys || 0);
  const h1 = Number(t.h1.buys || 0);
  return buys > 0 || t.vol_m5 > 0 || h1 > 0;
}

function talk() {
  if (!existsSync(TALK)) return '';
  return readFileSync(TALK, 'utf8');
}

function writePace(obj) {
  const body = { ...obj, fill: FILL, talk: TALK, window_s: WINDOW, rest_s: REST_S, now_unix: Math.floor(Date.now() / 1000) };
  writeFileSync(PACE, `${JSON.stringify(body, null, 2)}\n`);
}

const start = Math.floor(Date.now() / 1000);
log(`pace start ${start} cycles=${CYCLES} window=${WINDOW}`);

for (let cycle = 1; cycle <= CYCLES; cycle++) {
  const cycleStart = Math.floor(Date.now() / 1000);
  const deadline = cycleStart + WINDOW;
  let aero;
  let toshi;
  try {
    aero = await dexPair(AERO);
    toshi = await dexPair(TOSHI);
  } catch (err) {
    aero = { m5: { buys: 0, sells: 0 }, h1: { buys: 0, sells: 0 }, vol_m5: 0 };
    toshi = { m5: { buys: 0, sells: 0 }, h1: { buys: 0, sells: 0 }, vol_m5: 0 };
    log(`tape err ${err instanceof Error ? err.message : 'fetch'}`);
  }
  const open = tapeOpen(aero) || tapeOpen(toshi);
  let phase = open ? 'BUY' : 'REST';
  let extended = false;
  writePace({
    phase,
    cycle,
    cycles: CYCLES,
    cycle_start_unix: cycleStart,
    deadline_unix: deadline,
    tape_m5_aero: aero.m5,
    tape_m5_toshi: toshi.m5,
    tape_h1_aero: aero.h1,
    tape_h1_toshi: toshi.h1,
    extended,
    note: open
      ? `cycle ${cycle}/${CYCLES} BUY. 180s then POLL/RECYCLE.`
      : `cycle ${cycle}/${CYCLES} REST skip THIS window (dead tape). Next cycle at deadline.`,
  });
  log(`cycle ${cycle} phase=${phase} deadline=${deadline}`);

  while (Math.floor(Date.now() / 1000) < deadline) {
    await new Promise((r) => setTimeout(r, TICK_MS));
    const now = Math.floor(Date.now() / 1000);
    const jl = talk();
    const hasBuy = /buyTx|"side":"buy"|"what":"buy"/.test(jl);
    const hasGreen = /"green"\s*:\s*true/.test(jl);
    const hasRecycle = /recycleTx|"what":"recycle"|"side":"sell"/.test(jl);
    try {
      aero = await dexPair(AERO);
      toshi = await dexPair(TOSHI);
    } catch {
      /* keep last tape */
    }
    if (phase === 'BUY' && hasBuy) phase = 'POLL';
    if (hasGreen) phase = 'SELL_GREEN';
    if (phase === 'POLL' && !extended && Number(aero.m5.buys || 0) > Number(aero.m5.sells || 0)) {
      extended = true;
    }
    const dl = extended ? deadline + 60 : deadline;
    if (now >= dl && phase !== 'REST' && hasBuy && !hasRecycle && !hasGreen) phase = 'RECYCLE';
    writePace({
      phase,
      cycle,
      cycles: CYCLES,
      cycle_start_unix: cycleStart,
      deadline_unix: dl,
      remaining_s: Math.max(0, dl - now),
      tape_m5_aero: aero.m5,
      tape_m5_toshi: toshi.m5,
      tape_h1_aero: aero.h1,
      tape_h1_toshi: toshi.h1,
      extended,
      note: `cycle ${cycle}/${CYCLES} ${phase}. window_s=180. suit pace.mjs`,
    });
  }
  await new Promise((r) => setTimeout(r, REST_S * 1000));
}

writePace({
  phase: 'REST',
  cycle: CYCLES,
  cycles: CYCLES,
  deadline_unix: 0,
  note: 'done 4x180s. suit pace.mjs stopped.',
});
log('pace done');
