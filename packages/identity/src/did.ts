/**
 * One DID from one Ed25519 public key.
 * PEM SPKI and 32-byte hex of the same key mint the same did:groover:…
 * New DIDs are sha256(raw 32-byte key) — 64 hex. Legacy 16-hex names still parse.
 */
import * as crypto from 'crypto';

export const GROOVER_DID_PREFIX = 'did:groover:';
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function ed25519PublicKeyToRawHex(pubkey: string): string {
  const n = pubkey.trim();
  if (n.includes('BEGIN PUBLIC KEY')) {
    const key = crypto.createPublicKey(n);
    if (key.asymmetricKeyType !== 'ed25519') {
      throw new Error('public key is not Ed25519');
    }
    const der = key.export({ type: 'spki', format: 'der' });
    if (der.length < 32) throw new Error('invalid SPKI public key');
    return Buffer.from(der.subarray(der.length - 32)).toString('hex');
  }
  const hex = n.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]+$/.test(hex) || hex.length !== 64) {
    throw new Error('ed25519 public key must be 32-byte hex or SPKI PEM');
  }
  return hex;
}

export function ed25519PublicKeyToPem(pubkey: string): string {
  const n = pubkey.trim();
  if (n.includes('BEGIN PUBLIC KEY')) {
    const key = crypto.createPublicKey(n);
    if (key.asymmetricKeyType !== 'ed25519') {
      throw new Error('public key is not Ed25519');
    }
    return key.export({ type: 'spki', format: 'pem' }).toString();
  }
  const raw = Buffer.from(ed25519PublicKeyToRawHex(n), 'hex');
  const der = Buffer.concat([SPKI_ED25519_PREFIX, raw]);
  const b64 = der.toString('base64');
  return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----`;
}

export function didFromEd25519PublicKey(pubkey: string): string {
  const raw = Buffer.from(ed25519PublicKeyToRawHex(pubkey), 'hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return `${GROOVER_DID_PREFIX}${hash}`;
}

/** Legacy 16-hex names (pre-fix) and full-width 64-hex names. */
export function isCanonicalGrooverDid(did: string): boolean {
  return (
    typeof did === 'string' &&
    (/^did:groover:[0-9a-f]{16}$/.test(did) || /^did:groover:[0-9a-f]{64}$/.test(did))
  );
}

export function isFullWidthGrooverDid(did: string): boolean {
  return typeof did === 'string' && /^did:groover:[0-9a-f]{64}$/.test(did);
}
