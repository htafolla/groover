import { describe, it, expect } from 'vitest';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';
import {
  grooverIdentityDna,
  identityKey,
  inventoryDna,
  isCanonicalGrooverDid,
  listPackIds,
  prepareMintInput,
  variantFromKey,
} from './suit-dna.js';
import { registerPackAdapter } from './packs/index.js';

describe('GRVR suit DNA', () => {
  const did = 'did:groover:aaaaaaaaaaaaaaaa';

  it('accepts canonical 28-byte DIDs only', () => {
    expect(isCanonicalGrooverDid(did)).toBe(true);
    expect(isCanonicalGrooverDid('did:groover:test0000000001')).toBe(false);
    expect(isCanonicalGrooverDid('did:groover:zzzzzzzzzzzzzzzz')).toBe(false);
  });

  it('hashes inventory without mintedAt or dna', () => {
    const fixture = { consumer: { name: 'acme', version: '1.0.0' }, suit: 'overlay' };
    const a = inventoryDna({ ...fixture, mintedAt: '2026-01-01T00:00:00.000Z' });
    const b = inventoryDna({ ...fixture, mintedAt: '2099-01-01T00:00:00.000Z', dna: '0xdead' });
    expect(a).toBe(b);
    expect(a).toBe('0x8e4801128164478c23726a44b13e6b5bebb9187050ad484495a0ea4718b44424');
  });

  it('identityKey is keccak256(abi.encode(did, dna)) via viem', () => {
    const dna = grooverIdentityDna(did);
    const key = identityKey(did, dna);
    expect(key).toMatch(/^0x[0-9a-f]{64}$/);
    expect(variantFromKey(key)).toBeGreaterThanOrEqual(0);
    expect(variantFromKey(key)).toBeLessThan(16);
    expect(identityKey(did, dna)).toBe(key);
  });

  it('prepareMintInput groover-identity does not need inventory', () => {
    const prepared = prepareMintInput({ did, pack: 'groover-identity' });
    expect(prepared.pack).toBe('groover-identity');
    expect(prepared.dna).toBe(grooverIdentityDna(did));
  });

  it('prepareMintInput 0xray-suit requires inspect.ok and matching dna', () => {
    const inventory = { consumer: { name: 'review-suit', version: '0.0.1' }, suit: 'overlay' };
    expect(() => prepareMintInput({ did, pack: '0xray-suit', inventory })).toThrow(/inspect.ok/);
    const dna = inventoryDna(inventory);
    const prepared = prepareMintInput({
      did,
      pack: '0xray-suit',
      inventory,
      inspect: { ok: true, dna },
    });
    expect(prepared.dna).toBe(dna);
    expect(() =>
      prepareMintInput({
        did,
        pack: '0xray-suit',
        inventory,
        inspect: { ok: true, dna: `0x${'ab'.repeat(32)}` },
      }),
    ).toThrow(/does not match/);
  });

  it('empty keccak256 matches Ethereum', () => {
    expect(bytesToHex(keccak_256(new Uint8Array(0)))).toBe(
      'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    );
  });

  it('lists builtin packs and rejects unknown packs', () => {
    expect(listPackIds()).toEqual(expect.arrayContaining(['0xray-suit', 'groover-identity']));
    expect(() => prepareMintInput({ did, pack: 'clearing-receipt' })).toThrow(/unknown pack/);
  });

  it('a new pack adapter is a register() call (PR-shaped)', () => {
    registerPackAdapter({
      pack: 'test-schema',
      description: 'fixture',
      resolveDna: ({ did: d }) => grooverIdentityDna(d),
    });
    const prepared = prepareMintInput({ did, pack: 'test-schema' });
    expect(prepared.pack).toBe('test-schema');
    expect(prepared.dna).toBe(grooverIdentityDna(did));
  });
});
