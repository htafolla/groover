/**
 * Closed GRVR trait compositor. Pack = chassis class. Variant 0..15 = hat mesh × colorway.
 * Railway renders SVG from on-chain TokenView. Not Imagine. Not on-chain pixels.
 */
import { GRVR_MAX_VARIANT } from './suit-dna.js';

export const HATS = ['mill-cap', 'constitution-visor', 'job-helm', 'inspect-visor'] as const;
export const COLORWAYS = ['mill-cyan', 'inspect-amber', 'groover-violet', 'overlay-steel'] as const;
export const BANNERS: Record<(typeof HATS)[number], string> = {
  'mill-cap': 'MILL',
  'constitution-visor': 'CONSTITUTION',
  'job-helm': 'JOB',
  'inspect-visor': 'INSPECT',
};

export type Hat = (typeof HATS)[number];
export type Colorway = (typeof COLORWAYS)[number];
export type Armor = 'ribbed' | 'hex-gem';

export type TokenView = {
  tokenId: string;
  did: string;
  pack: string;
  variant: number;
  dna: string;
};

type Palette = {
  bg: string;
  bay: string;
  plate: string;
  dark: string;
  accent: string;
  visor: string;
  glass: string;
  ink: string;
  dim: string;
};

const PALETTES: Record<Colorway, Palette> = {
  'mill-cyan': {
    bg: '#05070c', bay: '#0a1218', plate: '#1a3a48', dark: '#0d222c',
    accent: '#3ec8f5', visor: '#082030', glass: '#1a6a88', ink: '#f4f7fb', dim: '#6a8a99',
  },
  'inspect-amber': {
    bg: '#0c0905', bay: '#161008', plate: '#4a3414', dark: '#2a1c08',
    accent: '#f5b63e', visor: '#2a1808', glass: '#8a6020', ink: '#f4f7fb', dim: '#9a8860',
  },
  'groover-violet': {
    bg: '#0a0712', bay: '#120a1c', plate: '#3a2460', dark: '#1c1230',
    accent: '#9b7dff', visor: '#180828', glass: '#5a40a0', ink: '#f4f7fb', dim: '#8a7aaa',
  },
  'overlay-steel': {
    bg: '#07090c', bay: '#101418', plate: '#3a4a58', dark: '#1a242c',
    accent: '#7aa0b8', visor: '#12181c', glass: '#4a6070', ink: '#f4f7fb', dim: '#6a7a88',
  },
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

export function armorFromPack(pack: string): Armor {
  return pack === '0xray-suit' ? 'ribbed' : 'hex-gem';
}

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dnaByte(dna: string, i: number): number {
  const hex = (dna || '').replace(/^0x/i, '');
  const pair = hex.slice(i * 2, i * 2 + 2);
  const n = Number.parseInt(pair, 16);
  return Number.isFinite(n) ? n : 0;
}

function baySvg(pal: Palette, dna: string): string {
  const kind = dnaByte(dna, 0) % 3;
  const rail = pal.dim;
  if (kind === 1) {
    return `<g id="bay" data-bay="1">
      <rect width="512" height="512" fill="${pal.bay}"/>
      <rect x="40" y="36" width="432" height="10" fill="${rail}" opacity="0.35"/>
      <rect x="380" y="80" width="48" height="280" fill="${pal.dark}" opacity="0.8"/>
      <rect x="392" y="96" width="8" height="8" fill="${pal.accent}" opacity="0.5"/>
      <rect x="408" y="120" width="8" height="8" fill="${pal.accent}" opacity="0.35"/>
    </g>`;
  }
  if (kind === 2) {
    return `<g id="bay" data-bay="2">
      <rect width="512" height="512" fill="${pal.bay}"/>
      <rect x="24" y="48" width="464" height="8" fill="${rail}" opacity="0.25"/>
      <rect x="24" y="64" width="464" height="8" fill="${pal.dark}" opacity="0.4"/>
      <rect x="80" y="90" width="36" height="220" fill="${pal.dark}" opacity="0.7"/>
    </g>`;
  }
  return `<g id="bay" data-bay="0">
    <rect width="512" height="512" fill="${pal.bay}"/>
    <rect x="48" y="40" width="416" height="8" fill="${rail}" opacity="0.3"/>
    <rect x="48" y="52" width="416" height="6" fill="${pal.dark}" opacity="0.45"/>
    <rect x="400" y="88" width="40" height="240" fill="${pal.dark}" opacity="0.75"/>
    <rect x="412" y="108" width="6" height="6" fill="${pal.accent}" opacity="0.45"/>
  </g>`;
}

function hatSvg(hat: Hat, pal: Palette): string {
  if (hat === 'mill-cap') {
    return `<g id="hat" data-hat="mill-cap" data-mesh="brim-cap">
      <path d="M92 168C92 156 124 148 160 148H352C388 148 420 156 420 168L404 184H108Z" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="2"/>
      <path d="M176 148C176 102 204 90 256 90C308 90 336 102 336 148Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="2"/>
      <path d="M196 118C196 110 316 110 316 118V136C316 144 196 144 196 136Z" fill="${pal.glass}" stroke="${pal.visor}" stroke-width="2"/>
      <path d="M208 124H304V130H208Z" fill="${pal.accent}" opacity="0.55"/>
    </g>`;
  }
  if (hat === 'constitution-visor') {
    return `<g id="hat" data-hat="constitution-visor" data-mesh="chevron">
      <path d="M256 44L338 92L318 168L256 148L194 168L174 92Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="2.5"/>
      <path d="M256 58L312 96L300 150L256 136L212 150L200 96Z" fill="${pal.glass}"/>
      <path d="M256 44L286 88L256 100L226 88Z" fill="${pal.accent}"/>
    </g>`;
  }
  if (hat === 'job-helm') {
    return `<g id="hat" data-hat="job-helm" data-mesh="dome">
      <path d="M164 176C164 64 348 64 348 176Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="2.5"/>
      <path d="M194 124C194 92 318 92 318 124C318 156 194 156 194 124Z" fill="${pal.glass}" stroke="${pal.visor}" stroke-width="2"/>
      <path d="M164 176H348L336 184H176Z" fill="${pal.dark}"/>
    </g>`;
  }
  return `<g id="hat" data-hat="inspect-visor" data-mesh="twin-slits">
    <path d="M184 76H328L348 176H164Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="2.5"/>
    <path d="M214 100H232V156H214Z" fill="${pal.glass}" stroke="${pal.visor}"/>
    <path d="M280 100H298V156H280Z" fill="${pal.glass}" stroke="${pal.visor}"/>
    <path d="M164 108C148 108 140 124 148 140C156 156 168 148 168 132V116Z" fill="${pal.dark}" stroke="${pal.accent}"/>
    <path d="M348 108C364 108 372 124 364 140C356 156 344 148 344 132V116Z" fill="${pal.dark}" stroke="${pal.accent}"/>
    <path d="M167 122C167 117 175 117 175 122C175 127 167 127 167 122Z" fill="${pal.accent}"/>
    <path d="M337 122C337 117 345 117 345 122C345 127 337 127 337 122Z" fill="${pal.accent}"/>
  </g>`;
}

function chassisSvg(armor: Armor, pal: Palette, label: string): string {
  if (armor === 'ribbed') {
    return `<g id="chassis" data-armor="ribbed">
      <path d="M118 176 L160 160 H352 L394 176 L410 268 L352 404 H160 L102 268 Z" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="2"/>
      <path d="M168 176 H344 L360 250 L344 360 H168 L152 250 Z" fill="${pal.plate}"/>
      <rect x="176" y="188" width="160" height="48" rx="4" fill="${pal.dark}" stroke="${pal.accent}"/>
      <text x="256" y="218" text-anchor="middle" fill="${pal.accent}" font-family="monospace" font-size="13">${label}</text>
      <rect x="188" y="248" width="136" height="14" fill="${pal.dark}"/>
      <rect x="188" y="266" width="136" height="14" fill="${pal.dark}"/>
      <rect x="188" y="284" width="136" height="14" fill="${pal.dark}"/>
      <rect x="188" y="302" width="136" height="14" fill="${pal.dark}"/>
      <path d="M132 200 L168 188 L168 250 L124 258 Z" fill="${pal.plate}" stroke="${pal.accent}"/>
      <path d="M380 200 L344 188 L344 250 L388 258 Z" fill="${pal.plate}" stroke="${pal.accent}"/>
    </g>`;
  }
  return `<g id="chassis" data-armor="hex-gem">
    <path d="M124 180 L256 156 L388 180 L400 270 L256 408 L112 270 Z" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="2"/>
    <path d="M168 196 L256 176 L344 196 L356 268 L256 348 L156 268 Z" fill="${pal.plate}"/>
    <path d="M256 210 L300 236 L282 286 L230 286 L212 236 Z" fill="${pal.accent}" opacity="0.85"/>
    <path d="M256 222 L286 240 L274 276 L238 276 L226 240 Z" fill="${pal.glass}"/>
    <rect x="214" y="188" width="84" height="22" rx="3" fill="${pal.dark}"/>
    <text x="256" y="204" text-anchor="middle" fill="${pal.accent}" font-family="monospace" font-size="12">${label}</text>
  </g>`;
}

function packCores(pack: string, pal: Palette): string {
  if (pack !== '0xray-suit') return '';
  return `<g id="mill-inspect-cores" data-pack="0xray-suit">
    <circle cx="176" cy="278" r="26" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="3"/>
    <circle cx="176" cy="278" r="10" fill="${pal.accent}" opacity="0.8"/>
    <text x="176" y="322" text-anchor="middle" fill="${pal.accent}" font-family="monospace" font-size="10">MILL</text>
    <circle cx="336" cy="278" r="26" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="3"/>
    <circle cx="336" cy="278" r="10" fill="${pal.accent}" opacity="0.8"/>
    <text x="336" y="322" text-anchor="middle" fill="${pal.accent}" font-family="monospace" font-size="10">INSPECT</text>
    <path d="M202 278 H310" stroke="${pal.accent}" stroke-width="2" opacity="0.7"/>
  </g>`;
}

export function composeIdentitySvg(view: TokenView): string {
  const traits = traitsFromVariant(view.variant);
  const pal = PALETTES[traits.colorway];
  const pack = view.pack || 'groover-identity';
  const armor = armorFromPack(pack);
  const banner = BANNERS[traits.hat];
  const did = xml(view.did || '');
  const tokenId = xml(String(view.tokenId || '0'));
  const dnaShort = xml((view.dna || '').slice(0, 10));
  const packLabel = xml(pack);
  const plateLabel = pack === '0xray-suit' ? 'EXO' : 'GRVR';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" data-pack="${packLabel}" data-variant="${traits.variant}" data-hat="${traits.hat}" data-colorway="${traits.colorway}" data-armor="${armor}">
${baySvg(pal, view.dna || '')}
${hatSvg(traits.hat, pal)}
<text x="256" y="178" text-anchor="middle" fill="${pal.ink}" font-family="monospace" font-size="14" font-weight="700">${banner}</text>
${chassisSvg(armor, pal, plateLabel)}
${packCores(pack, pal)}
<g id="hud">
  <rect x="32" y="428" width="448" height="56" fill="${pal.bg}" stroke="${pal.accent}" stroke-width="1" opacity="0.92"/>
  <text x="48" y="450" fill="${pal.ink}" font-family="monospace" font-size="13">#${tokenId} ${packLabel}</text>
  <text x="48" y="470" fill="${pal.dim}" font-family="monospace" font-size="11">${did} · ${dnaShort} · v${traits.variant}</text>
</g>
</svg>
`;
}
