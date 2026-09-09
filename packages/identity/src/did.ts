/**
 * One DID from one Ed25519 public key.
 * PEM SPKI and 32-byte hex of the same key mint the same did:groover:…
 */
import * as crypto from 'crypto';

export const GROOVER_DID_PREFIX = 'did:groover:';

export function ed25519PublicKeyToRawHex(pubkey: string): string {
  const trimmed = pubkey.trim();
  if (trimmed.includes('BEGIN PUBLIC KEY')) {
    const b64 = trimmed.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
    const der = Buffer.from(b64, 'base64');
    if (der.length < 32) throw new Error('invalid SPKI public key');
    return der.subarray(der.length - 32).toString('hex');
  }
  const hex = trimmed.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]+$/.test(hex) || hex.length !== 64) {
    throw new Error('ed25519 public key must be 32-byte hex or SPKI PEM');
  }
  return hex;
}

export function didFromEd25519PublicKey(pubkey: string): string {
  const hex = ed25519PublicKeyToRawHex(pubkey);
  const hash = crypto.createHash('sha256').update(hex).digest('hex').slice(0, 16);
  return `${GROOVER_DID_PREFIX}${hash}`;
}
