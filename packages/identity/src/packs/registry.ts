import { frameworkLogger } from '../../../xray/src/index.js';
import type { PackAdapter } from './types.js';

const adapters = new Map<string, PackAdapter>();

export function registerPackAdapter(adapter: PackAdapter): void {
  if (!adapter.pack || adapter.pack.length > 64) {
    throw new Error('pack id must be 1..64 bytes');
  }
  adapters.set(adapter.pack, adapter);
  frameworkLogger.log('identity', 'pack-adapter-register', 'info', { pack: adapter.pack });
}

export function getPackAdapter(pack: string): PackAdapter {
  const adapter = adapters.get(pack);
  if (!adapter) {
    const known = listPackIds().join(', ') || '(none)';
    throw new Error(`unknown pack "${pack}". Known: ${known}. Add packages/identity/src/packs/<name>.ts and register it.`);
  }
  return adapter;
}

export function listPackIds(): string[] {
  return [...adapters.keys()].sort();
}

export function listPackAdapters(): PackAdapter[] {
  return [...adapters.values()].sort((a, b) => a.pack.localeCompare(b.pack));
}
