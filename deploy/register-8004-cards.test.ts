import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REGISTRATION_CARDS,
  WEBSITE_FILE_BASE,
  resolveRegistrationCard,
  resolveSetUriTarget,
  tokenIdFromEnv,
} from './register-8004-cards.js';

const REG_DIR = path.join(
  process.cwd(),
  'website/static/identity/registration',
);

type GrooverCard = {
  type: string;
  name: string;
  description: string;
  image: string;
  services: Array<{ name: string; endpoint: string; version: string }>;
  active: boolean;
  registrations: Array<{ agentId: string; agentRegistry: string }>;
  groover: {
    did: string;
    grvrContract: string;
    grvrTokenId: string;
    erc8004AgentId: string;
    erc8004RegisterTx: string;
  };
};

function readCard(name: string): GrooverCard {
  return JSON.parse(readFileSync(path.join(REG_DIR, name), 'utf8')) as GrooverCard;
}

describe('register-8004 cards', () => {
  it('defaults to grvr-2 website URLs', () => {
    const card = resolveRegistrationCard({});
    expect(card.tokenId).toBe('2');
    expect(card.v1).toBe(`${WEBSITE_FILE_BASE}/grvr-2-v1.json`);
    expect(card.v2).toBe(`${WEBSITE_FILE_BASE}/grvr-2-v2.json`);
  });

  it('AGENT_ID 86556 selects blinky grvr-1 website URLs', () => {
    const card = resolveRegistrationCard({ AGENT_ID: '86556' });
    expect(card).toEqual(REGISTRATION_CARDS['1']);
    expect(card.v2).toBe(
      'https://website-production-c0da.up.railway.app/identity/registration/grvr-1-v2.json',
    );
  });

  it('GRVR_TOKEN_ID=1 wins over an unrelated AGENT_ID for URL pick', () => {
    expect(tokenIdFromEnv({ GRVR_TOKEN_ID: '1', AGENT_ID: '86025' })).toBe('1');
    const target = resolveSetUriTarget({ GRVR_TOKEN_ID: '1', AGENT_ID: '86556' });
    expect(target.agentId).toBe('86556');
    expect(target.uri).toBe(REGISTRATION_CARDS['1'].v2);
  });

  it('rejects unknown token ids', () => {
    expect(() => resolveRegistrationCard({ GRVR_TOKEN_ID: '9' })).toThrow(
      /unknown GRVR_TOKEN_ID/,
    );
  });
});

describe('blinky static registration files', () => {
  const v1 = readCard('grvr-1-v1.json');
  const v2 = readCard('grvr-1-v2.json');

  it('v1 and v2 match the gist body (grvr-2 v1/v2 also do not differ)', () => {
    expect(v1).toEqual(v2);
  });

  it('keeps agentId 86556 and v5 GRVR endpoint', () => {
    expect(v2.registrations[0]).toEqual({
      agentId: '86556',
      agentRegistry: 'eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    });
    expect(v2.services.find((s) => s.name === 'GRVR')?.endpoint).toBe(
      'eip155:8453:0x045B35480F289F8f83F53345A0f367875958957a/1',
    );
    expect(v2.groover.grvrContract).toBe(
      '0x045B35480F289F8f83F53345A0f367875958957a',
    );
    expect(v2.groover.grvrTokenId).toBe('1');
    expect(v2.groover.erc8004AgentId).toBe('86556');
    expect(v2.groover.erc8004RegisterTx).toBe(
      '0x4c47e48084b1f58602d51e8dbc8a07029177527218f3557972277934c4aa8c3c',
    );
    expect(v2.groover.did).toBe(
      'did:groover:869a20477a1e9a8c15760b15502a6d616f196d6546111138d7110a65f8ec1df9',
    );
    expect(v2.image).toBe(
      'https://registry-production-e2c4.up.railway.app/identity/token-image/1',
    );
    expect(v2.type).toBe('https://eips.ethereum.org/EIPS/eip-8004#registration-v1');
    expect(v2.active).toBe(true);
  });

  it('pair digest is stable for ops verify-after-deploy', () => {
    const digest = (name: string) =>
      createHash('sha256')
        .update(readFileSync(path.join(REG_DIR, name)))
        .digest('hex');
    expect(digest('grvr-1-v1.json')).toBe(
      'edef4912e541da61223f5656a5125ab69cbabbdbe7405da29fcb4b31ad46bf85',
    );
    expect(digest('grvr-1-v2.json')).toBe(
      'edef4912e541da61223f5656a5125ab69cbabbdbe7405da29fcb4b31ad46bf85',
    );
  });
});
