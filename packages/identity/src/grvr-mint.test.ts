import { describe, it, expect, afterEach } from 'vitest';
import {
  DRY_RUN_WITHOUT_CITATION,
  DYNAMO_MINT_BYPASS_WARNING,
  LIVE_MINT_CITATION_REQUIRED,
  compactSvg,
  mintGrvrIdentity,
  mintWantsOnchainSvg,
  minterKey,
  parseTokenIdParam,
  tokenIdFromMintReceipt,
} from './grvr-mint.js';
import { ZERO_DYNAMO_CITATION } from './suit-dna.js';

const DID = 'did:groover:aaaaaaaaaaaaaaaa';
const TO = '0x0000000000000000000000000000000000000001';
const PASS_CITATION = '0x' + 'ab'.repeat(32);

describe('GRVR mint key + receipt', () => {
  const prev = {
    GRVR_PRIVATE_KEY: process.env.GRVR_PRIVATE_KEY,
    DEPLOYER_PRIVATE_KEY: process.env.DEPLOYER_PRIVATE_KEY,
    GROOVER_MINTER_KEY: process.env.GROOVER_MINTER_KEY,
    DYNAMO_MINT_REQUIRED: process.env.DYNAMO_MINT_REQUIRED,
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
    delete process.env.DYNAMO_MINT_REQUIRED;
    process.env.DEPLOYER_PRIVATE_KEY = '0x' + '11'.repeat(32);
    const result = await mintGrvrIdentity({
      did: DID,
      pack: 'groover-identity',
      to: TO,
      dynamoCitation: PASS_CITATION,
      dryRun: false,
    });
    expect(result.dryRun).toBe(true);
    expect(result.citationPresent).toBe(true);
    expect(result.warning).toBeUndefined();
    expect(result.txHash).toBeUndefined();
    expect(result.tokenId).toBeUndefined();
  });

  it('rejects live mint without Dynamo PASS citation', async () => {
    delete process.env.DYNAMO_MINT_REQUIRED;
    process.env.GRVR_PRIVATE_KEY = '0x' + '33'.repeat(32);
    await expect(
      mintGrvrIdentity({
        did: DID,
        pack: 'groover-identity',
        to: TO,
        dryRun: false,
      }),
    ).rejects.toThrow(LIVE_MINT_CITATION_REQUIRED);
    await expect(
      mintGrvrIdentity({
        did: DID,
        pack: 'groover-identity',
        to: TO,
        dynamoCitation: ZERO_DYNAMO_CITATION,
        dryRun: false,
      }),
    ).rejects.toThrow(LIVE_MINT_CITATION_REQUIRED);
  });

  it('explicit dryRun without citation succeeds and is labeled', async () => {
    delete process.env.DYNAMO_MINT_REQUIRED;
    process.env.GRVR_PRIVATE_KEY = '0x' + '33'.repeat(32);
    const result = await mintGrvrIdentity({
      did: DID,
      pack: 'groover-identity',
      to: TO,
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.citationPresent).toBe(false);
    expect(result.warning).toBe(DRY_RUN_WITHOUT_CITATION);
    expect(result.txHash).toBeUndefined();
  });

  it('live mint with citation is not rejected at the policy gate', async () => {
    delete process.env.GRVR_PRIVATE_KEY;
    delete process.env.DYNAMO_MINT_REQUIRED;
    const result = await mintGrvrIdentity({
      did: DID,
      pack: 'groover-identity',
      to: TO,
      dynamoCitation: PASS_CITATION,
      dryRun: false,
    });
    expect(result.dryRun).toBe(true);
    expect(result.citationPresent).toBe(true);
  });

  it('DYNAMO_MINT_REQUIRED=false allows live-intent without citation (emergency)', async () => {
    process.env.DYNAMO_MINT_REQUIRED = 'false';
    delete process.env.GRVR_PRIVATE_KEY;
    const result = await mintGrvrIdentity({
      did: DID,
      pack: 'groover-identity',
      to: TO,
      dryRun: false,
    });
    expect(result.dryRun).toBe(true);
    expect(result.citationPresent).toBe(false);
    expect(result.warning).toBe(DYNAMO_MINT_BYPASS_WARNING);
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

  it('parseTokenIdParam requires a positive integer', () => {
    expect(parseTokenIdParam('2')).toBe(2n);
    expect(parseTokenIdParam('2?x=1')).toBe(2n);
    expect(parseTokenIdParam('0')).toBeNull();
    expect(parseTokenIdParam('nope')).toBeNull();
  });
});

describe('on-chain SVG mint helpers', () => {
  it('compactSvg strips newlines and tabs', () => {
    expect(compactSvg('<svg>\n\t<rect/>\n</svg>')).toBe('<svg><rect/></svg>');
  });

  it('mintWantsOnchainSvg is false for known 7-arg contracts', () => {
    expect(mintWantsOnchainSvg('0x7b184bf7B7054A7328a1D7851465c6001Bb2AFb3')).toBe(false);
    expect(mintWantsOnchainSvg('0x6C61feb8389c99EBf00576E7A110140866C5D9fF')).toBe(false);
    expect(mintWantsOnchainSvg('0x0abcd80C929Ff2f6c308958B112b7925801750D7')).toBe(false);
    expect(mintWantsOnchainSvg('0x7B184BF7B7054A7328A1D7851465C6001BB2AFB3')).toBe(false);
  });

  it('mintWantsOnchainSvg is true for v5, v4, v3, Sepolia v3, and a new address', () => {
    expect(mintWantsOnchainSvg('0x045B35480F289F8f83F53345A0f367875958957a')).toBe(true);
    expect(mintWantsOnchainSvg('0xD892D6836ab138a5aE4365dcb05Adb296607d6f9')).toBe(true);
    expect(mintWantsOnchainSvg('0x6F955cA006E2FE951750cac25372e098D6E89743')).toBe(true);
    expect(mintWantsOnchainSvg('0x0CEb73b07E1fdF3305cE4d3f6AC3BC28F8Ff8670')).toBe(true);
    expect(mintWantsOnchainSvg('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
  });
});
