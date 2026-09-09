import { describe, it, expect, afterEach } from 'vitest';
import { mintGrvrIdentity, minterKey, tokenIdFromMintReceipt } from './grvr-mint.js';

const DID = 'did:groover:aaaaaaaaaaaaaaaa';
const TO = '0x0000000000000000000000000000000000000001';

describe('GRVR mint key + receipt', () => {
  const prev = {
    GRVR_PRIVATE_KEY: process.env.GRVR_PRIVATE_KEY,
    DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY,
    GROOVER_MINTER_KEY: process.env.GROOVER_MINTER_KEY,
  };

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('minterKey ignores DEPLOYER_PRIVATE_KEY and GROOVER_MINTER_KEY', () => {
    delete process.env.GRVR_PRIVATE_KEY;
    process.env.DEPLOYER_PRIVATE_KEY = '0x' + '11'.repeat(32);
    process.env.GROOVER_MINTER_KEY = '0x' + '22'.repeat(32);
    expect(minterKey()).toBeNull();
  });

  it('empty GRVR_PRIVATE_KEY is missing', () => {
    process.env.GRVR_PRIVATE_KEY = '   ';
    expect(minterKey()).toBeNull();
  });

  it('dry-runs when GRVR_PRIVATE_KEY is unset even if dryRun is false', async () => {
    delete process.env.GRVR_PRIVATE_KEY;
    process.env.DEPLOYER_PRIVATE_KEY = '0x' + '11'.repeat(32);
    const result = await mintGrvrIdentity({
      did: DID,
      pack: 'groover-identity',
      to: TO,
      dryRun: false,
    });
    expect(result.dryRun).toBe(true);
    expect(result.txHash).toBeUndefined();
    expect(result.tokenId).toBeUndefined();
  });

  it('explicit dryRun does not send a tx', async () => {
    process.env.GRVR_PRIVATE_KEY = '0x' + '33'.repeat(32);
    const result = await mintGrvrIdentity({
      did: DID,
      pack: 'groover-identity',
      to: TO,
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.txHash).toBeUndefined();
  });

  it('reverted receipt does not look like success', () => {
    expect(() =>
      tokenIdFromMintReceipt({ status: 'reverted', logs: [] }, []),
    ).toThrow(/reverted/);
  });

  it('success without IdentityMinted has no tokenId', () => {
    expect(() =>
      tokenIdFromMintReceipt({ status: 'success', logs: [] }, []),
    ).toThrow(/no tokenId/);
  });
});
