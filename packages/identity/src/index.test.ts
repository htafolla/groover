import { describe, it, expect } from 'vitest';
import {
  generateDID,
  bindCrypto,
  verifySignature,
  generateKeyPair,
  signPayload,
  verifyWithPublic,
  IdentityEngine,
  ed25519PublicKeyToRawHex,
  issueSuiBinding,
} from './index.js';
import * as crypto from 'crypto';

describe('@groover/identity', () => {
  it('generateDID returns did:groover:...', () => {
    const did = generateDID('testpubkey123');
    expect(did).toMatch(/^did:groover:/);
  });

  it('bindCrypto + verifySignature round-trips correctly', () => {
    const binding = bindCrypto('testpubkey123', 'payload');
    expect(binding.ok).toBe(true);
    expect(verifySignature('testpubkey123', 'payload', binding.signature)).toBe(true);
  });

  it('ed25519 sign/verify round-trips correctly', () => {
    const keys = generateKeyPair();
    const sig = signPayload(keys.privateKey, 'test');
    expect(verifyWithPublic(keys.publicKey, 'test', sig)).toBe(true);
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

  it('IdentityEngine bindForRegistration produces DID and apiKey', () => {
    const engine = new IdentityEngine();
    const regBind = engine.bindForRegistration('pubkey456', 'payload2');
    expect(regBind.did).toMatch(/^did:groover:/);
    expect(regBind.apiKey).toMatch(/^groover_/);
  });
});
