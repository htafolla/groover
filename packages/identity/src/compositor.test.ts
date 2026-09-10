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

  it('16 variants yield 16 unique SVG strings', () => {
    const svgs = new Set<string>();
    for (let v = 0; v < GRVR_MAX_VARIANT; v += 1) {
      svgs.add(composeIdentitySvg({ ...base, pack: 'groover-identity', variant: v }));
    }
    expect(svgs.size).toBe(16);
  });

  it('four visors contain distinct mesh markers and no fedora brim', () => {
    const mill = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: 0 });
    const constitution = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: 4 });
    const job = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: 8 });
    const inspect = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: 12 });

    expect(mill).toContain('data-hat="mill-cap"');
    expect(mill).toContain('data-mesh="hud-plate"');
    expect(mill).toContain('data-cavity="1"');
    expect(mill).toContain('M108 40H404L416 164H96Z');
    expect(mill).toContain('M140 88H372L360 144H152Z');
    expect(mill).not.toContain('data-mesh="brim-cap"');
    expect(mill).not.toContain('M124 184H388L372 208H140Z');
    expect(mill).toContain('id="collar"');

    expect(constitution).toContain('data-hat="constitution-visor"');
    expect(constitution).toContain('data-mesh="chevron"');
    expect(constitution).toContain('M256 28L384 88L368 168H144L128 88Z');
    expect(constitution).toContain('M256 28L312 84L256 100L200 84Z');

    expect(job).toContain('data-hat="job-helm"');
    expect(job).toContain('data-mesh="dome"');
    expect(job).toContain('M104 168L124 52Q256 12 388 52L408 168Z');
    expect(job).toContain('M148 84Q256 48 364 84L364 136Q256 164 148 136Z');

    expect(inspect).toContain('data-hat="inspect-visor"');
    expect(inspect).toContain('data-mesh="twin-slits"');
    expect(inspect).toContain('M116 44H396L412 164H100Z');
    expect(inspect).toContain('M176 76H224V144H176Z');
    expect(inspect).toContain('M288 76H336V144H288Z');

    const visors = [mill, constitution, job, inspect].map((svg) => {
      const block = svg.match(/<g id="hat"[\s\S]*?<\/g>/)?.[0] ?? '';
      expect(block).not.toContain('<ellipse');
      return block;
    });
    const pathSets = visors.map((block) => [...block.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join('|'));
    expect(new Set(pathSets).size).toBe(4);

    const meshes = [mill, constitution, job, inspect].map(
      (svg) => svg.match(/data-mesh="([^"]+)"/)?.[1],
    );
    expect(meshes).toEqual(['hud-plate', 'chevron', 'dome', 'twin-slits']);
    expect(new Set(meshes).size).toBe(4);
  });

  it('0xray-suit is ribbed armor with mill cores; groover-identity is hex gem without cores', () => {
    const suit = composeIdentitySvg({ ...base, pack: '0xray-suit', variant: 0 });
    const identity = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: 0 });
    expect(suit).toContain('id="mill-inspect-cores"');
    expect(suit).toContain('data-armor="ribbed"');
    expect(suit).toContain('y="308" width="144" height="14"');
    expect(suit).toContain('M64 244L128 220L160 236V328L80 352Z');
    expect(identity).not.toContain('id="mill-inspect-cores"');
    expect(identity).toContain('data-armor="hex-gem"');
    expect(identity).toContain('M60 248L132 216L164 236V332L76 356Z');
    expect(identity).toContain('M256 308L318 348L292 400L220 400L194 348Z');
    expect(identity).not.toContain('data-armor="ribbed"');
  });

  it('four colorways use four different accent hex fills', () => {
    const accents = new Set<string>();
    for (let v = 0; v < 4; v += 1) {
      const svg = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: v });
      const accent = svg.match(/data-hat="mill-cap"[\s\S]*?stroke="(#[0-9a-fA-F]{6})"/)?.[1];
      expect(accent).toMatch(/^#[0-9a-fA-F]{6}$/);
      if (accent) accents.add(accent);
    }
    expect(accents.size).toBe(4);
    expect(accents).toEqual(new Set(['#3ec8f5', '#ffcc55', '#c4b0ff', '#c8d8e4']));
  });

  it('colorways recolor plate, visor glass, and bay — not only an accent stroke', () => {
    const plates = new Set<string>();
    const glasses = new Set<string>();
    const bays = new Set<string>();
    for (let v = 0; v < 4; v += 1) {
      const svg = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: v });
      const plate = svg.match(
        /M108 40H404L416 164H96Z" fill="(#[0-9a-fA-F]{6})"/,
      );
      const glass = svg.match(
        /M140 88H372L360 144H152Z" fill="(#[0-9a-fA-F]{6})"/,
      );
      const bay = svg.match(/id="bay"[^>]*>\s*<rect width="512" height="512" fill="(#[0-9a-fA-F]{6})"/);
      expect(plate?.[1]).toBeDefined();
      expect(glass?.[1]).toBeDefined();
      expect(bay?.[1]).toBeDefined();
      plates.add(plate![1]);
      glasses.add(glass![1]);
      bays.add(bay![1]);
    }
    expect(plates.size).toBe(4);
    expect(glasses.size).toBe(4);
    expect(bays.size).toBe(4);
  });

  it('banner is MILL/CONSTITUTION/JOB/INSPECT from hat, never CONSTITUTION ON unless constitution-visor', () => {
    const fromHat = {
      'mill-cap': 'MILL',
      'constitution-visor': 'CONSTITUTION',
      'job-helm': 'JOB',
      'inspect-visor': 'INSPECT',
    } as const;
    for (const pack of ['groover-identity', '0xray-suit'] as const) {
      for (let v = 0; v < GRVR_MAX_VARIANT; v += 1) {
        const hat = HATS[v >> 2];
        const svg = composeIdentitySvg({ ...base, pack, variant: v });
        const banner = svg.match(/font-weight="700">([^<]*)<\/text>/)?.[1];
        expect(banner).toBe(fromHat[hat]);
        if (hat !== 'constitution-visor') {
          expect(svg).not.toContain('CONSTITUTION ON');
        }
      }
    }
  });

  it('typical SVG byte length is under 12000', () => {
    const typical = composeIdentitySvg({ ...base, pack: '0xray-suit', variant: 0 });
    expect(Buffer.byteLength(typical, 'utf8')).toBeLessThan(12000);
  });

  it('chassis plate fill is not the bay fill (contrast)', () => {
    for (let v = 0; v < 4; v += 1) {
      const svg = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: v });
      const bay = svg.match(/id="bay"[^>]*>.*?width="512" height="512" fill="(#[0-9a-fA-F]{6})"/)?.[1];
      const plate = svg.match(/data-armor="hex-gem"[\s\S]*?M160 248H352L376 316[\s\S]*?fill="(#[0-9a-fA-F]{6})"/)?.[1]
        ?? svg.match(/M160 248H352L376 316L340 404H172L136 316Z" fill="(#[0-9a-fA-F]{6})"/)?.[1];
      expect(bay).toMatch(/^#/);
      expect(plate).toMatch(/^#/);
      expect(plate).not.toBe(bay);
    }
  });

  it('HUD shows Level when provided', () => {
    const svg = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: 0, level: 3 });
    expect(svg).toContain('Resonant');
  });

  it('emits compact SVG with no control chars (on-chain mint)', () => {
    const svg = composeIdentitySvg({ ...base, pack: '0xray-suit', variant: 1, level: 3 });
    expect(/[\u0000-\u001f]/.test(svg)).toBe(false);
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('inspect-amber plate is not the bay (token-1 fail class)', () => {
    const svg = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: 1 });
    expect(svg).toContain('data-colorway="inspect-amber"');
    expect(svg).toContain('fill="#d4a03a"');
    expect(svg).toContain('fill="#1a1208"');
    expect(svg).toContain('fill="#ffe08a"');
    expect(svg).not.toContain('fill="#2a1c08"');
  });
});
