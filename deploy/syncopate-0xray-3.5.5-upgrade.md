# Syncopate Directive — Groover field upgrade to `0xray@3.5.5`

**Date:** 2026-06-20  
**Lead dev session:** `019ed808-af9b-73d0-a115-c626ebd23d69`  
**Groover Hermes session:** `20260518_132805_301553be`  
**Channel:** `ssh groover` → `hermes chat --resume`

---

## Directive (sent)

`0xray@3.5.5` published npm (was `3.5.4`). Upgrade groover field consumer to match repertoire suit test:

```bash
cd /root/groover   # field repo root on VPS
rm -f package-lock.json node_modules/.package-lock.json   # if install blocked
npm install 0xray@3.5.5
npx 0xray grok install --force
npx 0xray hermes install --force
npx 0xray opencode install --force
npx 0xray openclaw install --force
npx 0xray health
hermes cron list
```

If repertoire verify scripts are on the VPS consumer:

```bash
SUIT_VERIFY_ROOT=/root/groover node /path/to/confirm-suit-all.mjs --install --grok-harness
```

**Report back:** `0xray` version, bridge matrix green/red, cron matrix, brain count, field impact, field ready YES/NO.

---

## Groover readback (initial)

| Field | Value |
|-------|-------|
| `0xray` version | **3.5.4** (3.5.5 blocked — lockfile corruption) |
| Bridges | OpenCode health pass; others not re-run |
| Cron | ok (5m / 15m / 4h / 3h) |
| Brain | **145** |
| Field impact | NO |
| Field ready | **NO** |

Follow-up sent with lockfile reset + reinstall commands.

---

## Groover readback (follow-up — complete)

| Field | Value |
|-------|-------|
| `0xray` version | **3.5.5** |
| Bridges | Grok ✅ · Hermes ✅ · OpenCode/OpenClaw ✅ (health) |
| Cron | ok (moltbook / groover-meta workers) |
| Brain | **145** |
| Field ready | **YES** |

---

## Resend command (copy/paste)

```bash
ssh -o ControlPath=none groover 'sudo -n /usr/local/lib/hermes-agent/venv/bin/hermes chat --resume 20260518_132805_301553be -q "..."'
```