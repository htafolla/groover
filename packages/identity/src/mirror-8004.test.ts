import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MIRROR_SKIP_MISSING_CITATION,
  agentRegistryId,
  buildRegistrationV1,
  buildRegistrationV2,
  didShort,
  identityRegistry,
  mirrorEnabled,
  mirrorGrvrMint,
  writeRegistrationFiles,
} from './mirror-8004.js';

const sample = {
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

const PASS_CITATION = '0x' + 'ab'.repeat(32);

describe('ERC-8004 registration files', () => {
  const prev = {
    MIRROR_8004_ENABLED: process.env.MIRROR_8004_ENABLED,
    DYNAMO_MINT_REQUIRED: process.env.DYNAMO_MINT_REQUIRED,
    MIRROR_8004_FILE_DIR: process.env.MIRROR_8004_FILE_DIR,
  };
  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('didShort is first 12 hex of DID suffix', () => {
    expect(didShort(sample.did)).toBe('f60a3753b5ef');
  });

  it('v1 has required EIP fields, DID+GRVR services, active false, no registrations', () => {
    const file = buildRegistrationV1(sample);
    expect(file.type).toBe('https://eips.ethereum.org/EIPS/eip-8004#registration-v1');
    expect(file.name).toBe('groover-f60a3753b5ef');
    expect(file.description.length).toBeGreaterThan(20);
    expect(file.image).toContain('/2');
    expect(file.services.map((s) => s.name).sort()).toEqual(['DID', 'GRVR']);
    expect(file.active).toBe(false);
    expect(file.registrations).toBeUndefined();
    expect(file.supportedTrust).toEqual(['groover-provenance']);
    expect(file.groover.did).toBe(sample.did);
    expect(file.groover.dna).toBe(sample.dna);
  });

  it('v2 flips active and binds agentRegistry', () => {
    const file = buildRegistrationV2(sample, '85541');
    expect(file.active).toBe(true);
    expect(file.registrations?.[0]).toEqual({
      agentId: '85541',
      agentRegistry: 'eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    });
  });

  it('writes immutable v1 json', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mirror-8004-'));
    const { v1Path } = writeRegistrationFiles(dir, sample);
    const parsed = JSON.parse(readFileSync(v1Path, 'utf8')) as { name: string };
    expect(parsed.name).toBe('groover-f60a3753b5ef');
  });

  it('mirrorEnabled defaults false', () => {
    delete process.env.MIRROR_8004_ENABLED;
    expect(mirrorEnabled()).toBe(false);
    process.env.MIRROR_8004_ENABLED = 'true';
    expect(mirrorEnabled()).toBe(true);
  });

  it('Base sepolia registry is not the mainnet vanity address', () => {
    expect(identityRegistry(84532)).toBe('0x8004A818BFB912233c491871b3d84c89A494BD9e');
    expect(agentRegistryId(84532)).toContain('84532');
  });

  it('skips mirror without Dynamo PASS citation', async () => {
    delete process.env.DYNAMO_MINT_REQUIRED;
    process.env.MIRROR_8004_ENABLED = 'true';
    const dir = mkdtempSync(path.join(tmpdir(), 'mirror-8004-skip-'));
    process.env.MIRROR_8004_FILE_DIR = dir;
    const result = await mirrorGrvrMint(sample);
    expect(result.skipped).toBe(MIRROR_SKIP_MISSING_CITATION);
    expect(result.v1Path).toBeUndefined();
  });

  it('mirrors when citation is present', async () => {
    delete process.env.DYNAMO_MINT_REQUIRED;
    process.env.MIRROR_8004_ENABLED = 'true';
    const dir = mkdtempSync(path.join(tmpdir(), 'mirror-8004-cite-'));
    process.env.MIRROR_8004_FILE_DIR = dir;
    const result = await mirrorGrvrMint({ ...sample, dynamoCitation: PASS_CITATION });
    expect(result.skipped).toBeUndefined();
    expect(result.v1Path).toBe(path.join(dir, 'grvr-2-v1.json'));
    const parsed = JSON.parse(readFileSync(result.v1Path!, 'utf8')) as {
      groover: { dynamoCitation: string };
    };
    expect(parsed.groover.dynamoCitation).toBe(PASS_CITATION);
  });
});
