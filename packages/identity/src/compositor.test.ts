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

  it('four hats contain distinct mesh markers', () => {
    const mill = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: 0 });
    const constitution = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: 4 });
    const job = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: 8 });
    const inspect = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: 12 });

    expect(mill).toContain('data-hat="mill-cap"');
    expect(mill).toContain('data-mesh="brim-cap"');
    expect(mill).toContain('M92 168C92 156 124 148 160 148H352C388 148 420 156 420 168');
    expect(mill).toContain('M176 148C176 102 204 90 256 90C308 90 336 102 336 148Z');
    expect(mill).toContain('M196 118C196 110 316 110 316 118V136C316 144 196 144 196 136Z');

    expect(constitution).toContain('data-hat="constitution-visor"');
    expect(constitution).toContain('data-mesh="chevron"');
    expect(constitution).toContain('M256 44L338 92L318 168L256 148L194 168L174 92Z');
    expect(constitution).toContain('M256 44L286 88L256 100L226 88Z');

    expect(job).toContain('data-hat="job-helm"');
    expect(job).toContain('data-mesh="dome"');
    expect(job).toContain('M164 176C164 64 348 64 348 176Z');
    expect(job).toContain('M194 124C194 92 318 92 318 124C318 156 194 156 194 124Z');

    expect(inspect).toContain('data-hat="inspect-visor"');
    expect(inspect).toContain('data-mesh="twin-slits"');
    expect(inspect).toContain('M184 76H328L348 176H164Z');
    expect(inspect).toContain('M214 100H232V156H214Z');
    expect(inspect).toContain('M280 100H298V156H280Z');
    expect(inspect).toContain('M164 108C148 108 140 124 148 140C156 156 168 148 168 132V116Z');

    const visors = [mill, constitution, job, inspect].map((svg) => {
      const block = svg.match(/<g id="hat"[\s\S]*?<\/g>/)?.[0] ?? '';
      expect(block).not.toContain('<rect');
      expect(block).not.toContain('<ellipse');
      return block;
    });
    const pathSets = visors.map((block) => [...block.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join('|'));
    expect(new Set(pathSets).size).toBe(4);

    const meshes = [mill, constitution, job, inspect].map(
      (svg) => svg.match(/data-mesh="([^"]+)"/)?.[1],
    );
    expect(meshes).toEqual(['brim-cap', 'chevron', 'dome', 'twin-slits']);
    expect(new Set(meshes).size).toBe(4);
  });

  it('0xray-suit is ribbed armor with mill cores; groover-identity is hex gem without cores', () => {
    const suit = composeIdentitySvg({ ...base, pack: '0xray-suit', variant: 0 });
    const identity = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: 0 });
    expect(suit).toContain('id="mill-inspect-cores"');
    expect(suit).toContain('data-armor="ribbed"');
    expect(suit).toContain('y="248" width="136" height="14"');
    expect(identity).not.toContain('id="mill-inspect-cores"');
    expect(identity).toContain('data-armor="hex-gem"');
    expect(identity).toContain('M256 210 L300 236 L282 286 L230 286 L212 236 Z');
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
    expect(accents).toEqual(new Set(['#3ec8f5', '#f5b63e', '#9b7dff', '#7aa0b8']));
  });

  it('colorways recolor plate, visor glass, and bay — not only an accent stroke', () => {
    const plates = new Set<string>();
    const glasses = new Set<string>();
    const bays = new Set<string>();
    for (let v = 0; v < 4; v += 1) {
      const svg = composeIdentitySvg({ ...base, pack: 'groover-identity', variant: v });
      const plate = svg.match(
        /M176 148C176 102 204 90 256 90C308 90 336 102 336 148Z" fill="(#[0-9a-fA-F]{6})"/,
      );
      const glass = svg.match(
        /M196 118C196 110 316 110 316 118V136C316 144 196 144 196 136Z" fill="(#[0-9a-fA-F]{6})"/,
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
});
