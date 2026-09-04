import { describe, expect, it } from 'vitest';
import * as crypto from 'crypto';
import { generateKeyPair, issueSuiBinding, suiAddressFromEd25519PublicKey, verifySuiBinding } from './index.js';

function rawEd25519FromSpkiPem(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Buffer.from(b64, 'base64');
  return der.subarray(der.length - 32);
}

describe('sui wallet bind', () => {
  it('issues and verifies a Groover DID ↔ Sui address binding', async () => {
    const keys = generateKeyPair();
    const publicKeyHex = Buffer.from(rawEd25519FromSpkiPem(keys.publicKey)).toString('hex');
    const binding = await issueSuiBinding({
      publicKeyHex,
      principalId: 'principal-1',
      nowMs: 1_000,
      sign: (message) => crypto.sign(null, Buffer.from(message), keys.privateKey),
    });
    expect(binding.scheme).toBe('did:groover');
    expect(binding.did).toMatch(/^did:groover:/);
    expect(binding.suiAddress).toBe(suiAddressFromEd25519PublicKey(publicKeyHex));
    const verified = verifySuiBinding(binding, {
      principalId: 'principal-1',
      suiAddress: binding.suiAddress,
      nowMs: 1_000,
    });
    expect(verified).toEqual({ ok: true, reasons: [] });
  });

  it('rejects an expired binding', async () => {
    const keys = generateKeyPair();
    const publicKeyHex = Buffer.from(rawEd25519FromSpkiPem(keys.publicKey)).toString('hex');
    const binding = await issueSuiBinding({
      publicKeyHex,
      principalId: 'principal-1',
      nowMs: 1_000,
      ttlMs: 10,
      sign: (message) => crypto.sign(null, Buffer.from(message), keys.privateKey),
    });
    const verified = verifySuiBinding(binding, { nowMs: 2_000 });
    expect(verified.ok).toBe(false);
    expect(verified.reasons).toContain('wallet binding has expired');
  });
});
