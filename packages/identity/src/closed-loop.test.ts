import { describe, expect, it } from 'vitest';
import { buildRegistrationV1, buildRegistrationV2 } from './mirror-8004.js';

const mint = {
  did: 'did:groover:f60a3753b5ef6dd3',
  dna: '0x02aaf1b3cebf6fb014d46f3369141619f1b5f650b067175ea58a45aa74c78c14',
  pack: 'groover-identity',
  variant: 3,
  identityKey: '0x38fad504cb62a42c6706a36cf6b659e244a97dbffab7feb9516f85f8c415eb03',
  grvrContract: '0xD892D6836ab138a5aE4365dcb05Adb296607d6f9',
  grvrTokenId: '2',
  level: 3,
  chainId: 8453,
};

describe('closed loop 8004 ↔ GRVR', () => {
  it('v1 file round-trips DID and token id both directions', () => {
    const file = buildRegistrationV1(mint);
    const did = file.services.find((s) => s.name === 'DID')?.endpoint;
    const grvr = file.services.find((s) => s.name === 'GRVR')?.endpoint;
    expect(did).toBe(mint.did);
    expect(grvr).toBe(`eip155:8453:${mint.grvrContract}/${mint.grvrTokenId}`);
    expect(file.groover.did).toBe(did);
    expect(String(file.groover.grvrTokenId)).toBe(mint.grvrTokenId);
    expect(file.active).toBe(false);
  });

  it('v2 cycle adds agentId without dropping GRVR binding', () => {
    const file = buildRegistrationV2(mint, '85541');
    expect(file.active).toBe(true);
    expect(file.registrations?.[0]?.agentId).toBe('85541');
    expect(file.services.find((s) => s.name === 'GRVR')?.endpoint).toContain('/2');
    expect(file.groover.did).toBe(mint.did);
  });
});
