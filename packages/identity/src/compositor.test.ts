import { describe, it, expect } from 'vitest';
import {
  COLORWAYS,
  HATS,
  composeIdentitySvg,
  traitsFromVariant,
} from './compositor.js';
import { GRVR_MAX_VARIANT } from './suit-dna.js';

const base = {
  tokenId: '2',
  did: 'did:groover:aaaaaaaaaaaaaaaa',
  dna: '0x8e4801128164478c23726a44b13e6b5bebb9187050ad484495a0ea4718b44424',
};

describe('GRVR compositor', () => {
  it('maps 16 variants onto 4 hats × 4 colorways', () => {
    const looks = new Set<string>();
    for (let v = 0; v < GRVR_MAX_VARIANT; v += 1) {
      const t = traitsFromVariant(v);
      expect(HATS).toContain(t.hat);
      expect(COLORWAYS).toContain(t.colorway);
      looks.add(`${t.hat}/${t.colorway}`);
    }
    expect(looks.size).toBe(16);
    expect(() => traitsFromVariant(16)).toThrow(/0\.\.15/);
  });

  it('is deterministic and XML-escapes DID/pack', () => {
    const view = { ...base, pack: 'groover-identity', variant: 10 };
    const a = composeIdentitySvg(view);
    const b = composeIdentitySvg(view);
    expect(a).toBe(b);
    expect(a).toContain('data-hat="job-helm"');
    expect(a).toContain('data-colorway="groover-violet"');
    const evil = composeIdentitySvg({
      ...base,
      pack: 'groover-identity"><script>',
      did: 'did:groover:aa<script>aa',
      variant: 0,
    });
    expect(evil).not.toContain('<script>');
    expect(evil).toContain('&lt;script&gt;');
  });

  it('0xray-suit class includes mill and inspect cores; identity pack does not', () => {
    const suit = composeIdentitySvg({ ...base, pack: '0xray-suit', variant: 0 });
    const identity = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: 0 });
    expect(suit).toContain('data-pack="0xray-suit"');
    expect(suit).toContain('id="mill-inspect-cores"');
    expect(suit).toContain('EXO');
    expect(identity).not.toContain('id="mill-inspect-cores"');
    expect(identity).toContain('GRVR');
  });
});
