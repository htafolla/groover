/**
 * Closed GRVR trait compositor. Pack = class. Variant 0..15 = hat × colorway.
 * Not Imagine. Inventory is not on-chain; class look comes from pack.
 */
import { GRVR_MAX_VARIANT } from './suit-dna.js';

export const HATS = ['mill-cap', 'constitution-visor', 'job-helm', 'inspect-visor'] as const;
export const COLORWAYS = ['mill-cyan', 'inspect-amber', 'groover-violet', 'overlay-steel'] as const;

export type Hat = (typeof HATS)[number];
export type Colorway = (typeof COLORWAYS)[number];

export type TokenView = {
  tokenId: string;
  did: string;
  pack: string;
  variant: number;
  dna: string;
};

const PALETTES: Record<Colorway, { bg: string; accent: string; plate: string; ink: string; dim: string }> = {
  'mill-cyan': { bg: '#05070c', accent: '#3ec8f5', plate: '#123040', ink: '#f4f7fb', dim: '#6a8a99' },
  'inspect-amber': { bg: '#0c0905', accent: '#f5b63e', plate: '#403012', ink: '#f4f7fb', dim: '#9a8860' },
  'groover-violet': { bg: '#0a0712', accent: '#9b7dff', plate: '#2a2040', ink: '#f4f7fb', dim: '#8a7aaa' },
  'overlay-steel': { bg: '#07090c', accent: '#7aa0b8', plate: '#1a2830', ink: '#f4f7fb', dim: '#6a7a88' },
};

export function traitsFromVariant(variant: number): { hat: Hat; colorway: Colorway; variant: number } {
  if (!Number.isInteger(variant) || variant < 0 || variant >= GRVR_MAX_VARIANT) {
    throw new Error(`variant must be 0..${GRVR_MAX_VARIANT - 1}`);
  }
  return {
    hat: HATS[variant >> 2],
    colorway: COLORWAYS[variant & 3],
    variant,
  };
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hatSvg(hat: Hat, accent: string): string {
  if (hat === 'mill-cap') {
    return `<g id="hat" data-hat="mill-cap">
      <rect x="186" y="72" width="140" height="22" rx="4" fill="${accent}"/>
      <rect x="210" y="52" width="92" height="28" rx="6" fill="${accent}"/>
    </g>`;
  }
  if (hat === 'constitution-visor') {
    return `<g id="hat" data-hat="constitution-visor">
      <polygon points="256,48 318,88 194,88" fill="${accent}"/>
      <rect x="214" y="88" width="84" height="10" fill="${accent}"/>
    </g>`;
  }
  if (hat === 'job-helm') {
    return `<g id="hat" data-hat="job-helm">
      <path d="M186 110 C186 62 326 62 326 110 Z" fill="${accent}"/>
      <rect x="186" y="104" width="140" height="14" fill="${accent}"/>
    </g>`;
  }
  return `<g id="hat" data-hat="inspect-visor">
    <rect x="198" y="78" width="116" height="36" rx="8" fill="${accent}"/>
    <rect x="214" y="90" width="84" height="10" fill="#05070c"/>
  </g>`;
}

function packCores(pack: string, accent: string, plate: string): string {
  if (pack !== '0xray-suit') return '';
  return `<g id="mill-inspect-cores" data-pack="0xray-suit">
    <circle cx="168" cy="268" r="28" fill="${plate}" stroke="${accent}" stroke-width="3"/>
    <text x="168" y="273" text-anchor="middle" fill="${accent}" font-family="monospace" font-size="11">MILL</text>
    <circle cx="344" cy="268" r="28" fill="${plate}" stroke="${accent}" stroke-width="3"/>
    <text x="344" y="273" text-anchor="middle" fill="${accent}" font-family="monospace" font-size="10">INSPECT</text>
  </g>`;
}

export function composeIdentitySvg(view: TokenView): string {
  const traits = traitsFromVariant(view.variant);
  const pal = PALETTES[traits.colorway];
  const pack = view.pack || 'groover-identity';
  const did = xml(view.did || '');
  const tokenId = xml(String(view.tokenId || '0'));
  const dnaShort = xml((view.dna || '').slice(0, 10));
  const packLabel = xml(pack);
  const isSuit = pack === '0xray-suit';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" data-pack="${packLabel}" data-variant="${traits.variant}" data-hat="${traits.hat}" data-colorway="${traits.colorway}">
<rect width="512" height="512" fill="${pal.bg}"/>
<rect x="24" y="24" width="464" height="464" fill="none" stroke="${pal.accent}" stroke-width="2" opacity="0.35"/>
${hatSvg(traits.hat, pal.accent)}
<g id="chassis">
  <path d="M160 150 L352 150 L390 250 L352 390 L160 390 L122 250 Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="3"/>
  <rect x="214" y="186" width="84" height="36" rx="6" fill="${pal.bg}" stroke="${pal.accent}"/>
  <text x="256" y="210" text-anchor="middle" fill="${pal.accent}" font-family="monospace" font-size="12">${isSuit ? 'EXO' : 'GRVR'}</text>
</g>
${packCores(pack, pal.accent, pal.plate)}
<g id="hud">
  <rect x="48" y="420" width="416" height="56" fill="${pal.bg}" stroke="${pal.accent}" stroke-width="1"/>
  <text x="64" y="442" fill="${pal.ink}" font-family="monospace" font-size="13">#${tokenId} ${packLabel}</text>
  <text x="64" y="462" fill="${pal.dim}" font-family="monospace" font-size="11">${did} · ${dnaShort} · v${traits.variant}</text>
</g>
</svg>
`;
}
