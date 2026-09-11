/**
 * Canonical PoP messages. HMAC is not identity.
 */
import * as crypto from 'crypto';
import { ed25519PublicKeyToPem, ed25519PublicKeyToRawHex } from './did.js';

export const REGISTER_BIND_VERSION = 'groover-register:v1';
export const MINT_BIND_VERSION = 'groover-mint:v1';
export const MINT_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

export function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(rec).sort()) {
      out[key] = sortValue(rec[key]);
    }
    return out;
  }
  return value;
}

export function canonicalRegisterMessage(input: {
  nonce: string;
  publicKeyHex: string;
  payload: string;
  metadata: Record<string, unknown>;
}): string {
  return [
    REGISTER_BIND_VERSION,
    input.nonce,
    input.publicKeyHex,
    input.payload,
    stableJson(input.metadata),
  ].join('|');
}

export function canonicalMintMessage(input: {
  did: string;
  pack: string;
  to: string;
  issuedAtMs: number;
}): string {
  return [
    MINT_BIND_VERSION,
    input.did,
    input.pack,
    input.to.toLowerCase(),
    String(input.issuedAtMs),
  ].join('|');
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

export function isHashedApiKey(stored: string): boolean {
  return /^[0-9a-f]{64}$/.test(stored);
}

export function apiKeyMatches(stored: string, provided: string): boolean {
  const hashed = isHashedApiKey(stored) ? stored : hashApiKey(stored);
  const providedHash = hashApiKey(provided);
  const a = Buffer.from(hashed, 'hex');
  const b = Buffer.from(providedHash, 'hex');
  if (a.length !== 32 || b.length !== 32) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyEd25519(publicKey: string, message: string, signatureHex: string): boolean {
  try {
    const pem = ed25519PublicKeyToPem(publicKey);
    return crypto.verify(null, Buffer.from(message), pem, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

export function publicKeyFingerprint(publicKey: string): string {
  return ed25519PublicKeyToRawHex(publicKey);
}
