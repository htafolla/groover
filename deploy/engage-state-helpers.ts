import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { hashReply } from './engage-output-guard.js';

const MAX_REPLY_HASHES = Number(process.env.MAX_REPLY_HASHES ?? '100');

export interface ReplyHashState {
  recentReplyHashes?: string[];
}

export function loadRecentReplyHashes(state: ReplyHashState): Set<string> {
  return new Set(state.recentReplyHashes ?? []);
}

export function recordReplyHash(state: ReplyHashState, publicReply: string): void {
  const hash = hashReply(publicReply);
  const list = state.recentReplyHashes ?? [];
  if (!list.includes(hash)) list.push(hash);
  state.recentReplyHashes = list.slice(-MAX_REPLY_HASHES);
}

export function loadJsonState<T>(path: string, fallback: T): T {
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf-8')) as T;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function saveJsonState<T>(path: string, state: T): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}