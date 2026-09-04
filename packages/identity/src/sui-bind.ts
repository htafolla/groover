/**
 * Groover DID ↔ Sui address binding.
 * Portable proof Credible verifies without importing this package.
 * Message: credible-sui-bind:v1|{scheme}|{did}|{suiAddress}|{principalId}|{issuedAtMs}|{notAfterMs}
 */
import * as crypto from 'crypto';
import { blake2b } from '@noble/hashes/blake2b';

function didFromPubkey(publicKey: string): string {
  const hash = crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 16);
  return `did:groover:${hash}`;
}

export const GROOVER_SUI_SCHEME = 'did:groover';
export const SUI_BIND_VERSION = 'credible-sui-bind:v1';

export interface SuiWalletBinding {
  scheme: string;
  did: string;
  suiAddress: string;
  publicKey: string;
  principalId: string;
  issuedAtMs: number;
  notAfterMs: number;
  signature: string;
}

export function canonicalSuiBindMessage(binding: Omit<SuiWalletBinding, 'signature'>): string {
  return [
    SUI_BIND_VERSION,
    binding.scheme,
    binding.did,
    binding.suiAddress,
    binding.principalId,
    String(binding.issuedAtMs),
    String(binding.notAfterMs),
  ].join('|');
}

function normalizeHex(value: string): string {
  return value.trim().toLowerCase().replace(/^0x/, '');
}

function hexToBytes(value: string): Uint8Array {
  const hex = normalizeHex(value);
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) {
    throw new Error('invalid hex');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function spkiPemFromRawEd25519(raw32: Uint8Array): string {
  const prefix = Buffer.from('302a300506032b6570032100', 'hex');
  const der = Buffer.concat([prefix, Buffer.from(raw32)]);
  const b64 = der.toString('base64');
  return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----`;
}

export function suiAddressFromEd25519PublicKey(publicKeyHex: string): string {
  const raw = hexToBytes(publicKeyHex);
  if (raw.length !== 32) throw new Error('ed25519 public key must be 32 bytes');
  const flagged = new Uint8Array(1 + raw.length);
  flagged[0] = 0x00;
  flagged.set(raw, 1);
  const hash = blake2b(flagged, { dkLen: 32 });
  return `0x${Buffer.from(hash).toString('hex')}`;
}

export type IssueSuiBindingInput = {
  publicKeyHex: string;
  principalId: string;
  sign: (message: Uint8Array) => Uint8Array | Promise<Uint8Array>;
  did?: string;
  nowMs?: number;
  ttlMs?: number;
};

export async function issueSuiBinding(input: IssueSuiBindingInput): Promise<SuiWalletBinding> {
  const publicKey = normalizeHex(input.publicKeyHex);
  const suiAddress = suiAddressFromEd25519PublicKey(publicKey);
  const nowMs = input.nowMs ?? Date.now();
  const fields: Omit<SuiWalletBinding, 'signature'> = {
    scheme: GROOVER_SUI_SCHEME,
    did: input.did ?? didFromPubkey(publicKey),
    suiAddress,
    publicKey,
    principalId: input.principalId,
    issuedAtMs: nowMs,
    notAfterMs: nowMs + (input.ttlMs ?? 86_400_000),
  };
  const signature = Buffer.from(await input.sign(new TextEncoder().encode(canonicalSuiBindMessage(fields)))).toString(
    'hex',
  );
  return { ...fields, signature };
}

export function verifySuiBinding(
  binding: SuiWalletBinding,
  expected?: { principalId?: string; suiAddress?: string; nowMs?: number },
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (binding.scheme !== GROOVER_SUI_SCHEME) reasons.push('scheme must be did:groover');
  try {
    const derived = suiAddressFromEd25519PublicKey(binding.publicKey);
    if (derived !== binding.suiAddress) reasons.push('public key does not derive the bound Sui address');
    if (expected?.suiAddress && derived !== expected.suiAddress) {
      reasons.push('binding sui address does not match expected signer');
    }
  } catch {
    reasons.push('invalid public key');
  }
  if (expected?.principalId && binding.principalId !== expected.principalId) {
    reasons.push('binding principalId does not match');
  }
  const now = expected?.nowMs ?? Date.now();
  if (now < binding.issuedAtMs) reasons.push('wallet binding is not yet valid');
  if (now > binding.notAfterMs) reasons.push('wallet binding has expired');
  try {
    const pem = spkiPemFromRawEd25519(hexToBytes(binding.publicKey));
    const ok = crypto.verify(
      null,
      Buffer.from(canonicalSuiBindMessage(binding)),
      pem,
      Buffer.from(normalizeHex(binding.signature), 'hex'),
    );
    if (!ok) reasons.push('binding signature is invalid');
  } catch {
    reasons.push('binding signature is invalid');
  }
  return { ok: reasons.length === 0, reasons };
}
