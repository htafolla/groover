import { describe, it, expect } from 'vitest';
import {
  generateDID,
  bindCrypto,
  generateKeyPair,
  signPayload,
  verifyWithPublic,
  IdentityEngine,
  ed25519PublicKeyToRawHex,
  issueSuiBinding,
  isCanonicalGrooverDid,
  isFullWidthGrooverDid,
} from './index.js';
import * as crypto from 'crypto';

describe('@groover/identity', () => {
  it('generateDID is full-width sha256 of the raw Ed25519 key', () => {
    const keys = generateKeyPair();
    const did = generateDID(keys.publicKey);
    expect(did).toMatch(/^did:groover:[0-9a-f]{64}$/);
    expect(isFullWidthGrooverDid(did)).toBe(true);
    expect(isCanonicalGrooverDid(did)).toBe(true);
    expect(generateDID(ed25519PublicKeyToRawHex(keys.publicKey))).toBe(did);
  });

  it('generateDID rejects non-Ed25519 material', () => {
    expect(() => generateDID('testpubkey123')).toThrow(/ed25519 public key/);
  });

  it('HMAC identity binding is removed', () => {
    expect(() => bindCrypto('ab'.repeat(16), 'payload')).toThrow(/HMAC/);
  });

  it('ed25519 sign/verify round-trips correctly', () => {
    const keys = generateKeyPair();
    const sig = signPayload(keys.privateKey, 'test');
    expect(verifyWithPublic(keys.publicKey, 'test', sig)).toBe(true);
    expect(verifyWithPublic(ed25519PublicKeyToRawHex(keys.publicKey), 'test', sig)).toBe(true);
  });

  it('hex HMAC is not accepted as PoP', () => {
    const hex = 'ab'.repeat(32);
    const hmac = crypto.createHmac('sha256', Buffer.from(hex, 'hex')).update('payload').digest('hex');
    expect(verifyWithPublic(hex, 'payload', hmac)).toBe(false);
  });

  it('PEM and raw hex of the same Ed25519 key mint the same DID as a Sui bind', async () => {
    const keys = generateKeyPair();
    const hex = ed25519PublicKeyToRawHex(keys.publicKey);
    expect(generateDID(keys.publicKey)).toBe(generateDID(hex));
    const binding = await issueSuiBinding({
      publicKeyHex: hex,
      sign: (message) => crypto.sign(null, Buffer.from(message), keys.privateKey),
    });
    expect(binding.did).toBe(generateDID(keys.publicKey));
  });

  it('legacy 16-hex DID still parses as canonical', () => {
    expect(isCanonicalGrooverDid('did:groover:aaaaaaaaaaaaaaaa')).toBe(true);
    expect(isFullWidthGrooverDid('did:groover:aaaaaaaaaaaaaaaa')).toBe(false);
  });

  it('IdentityEngine bindForRegistration produces DID and apiKey from Ed25519', () => {
    const engine = new IdentityEngine();
    const keys = generateKeyPair();
    const regBind = engine.bindForRegistration(keys.publicKey, 'payload2');
    expect(regBind.did).toMatch(/^did:groover:[0-9a-f]{64}$/);
    expect(regBind.apiKey).toMatch(/^groover_/);
  });
});
