/**
 * Closed GRVR trait compositor. Pack = chassis class. Variant 0..15 = visor mesh × colorway.
 * Railway (and on-chain tokenURI image) render this SVG. Not Imagine. Not PNG.
 *
 * Scene: front-on headless collar. Visor is the face. Torso sits below the neck.
 */
import { GRVR_MAX_VARIANT, GRVR_LEVEL_NAMES } from './suit-dna.js';

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
  level?: number;
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
    bg: '#030508',
    bay: '#071018',
    plate: '#2a8ab0',
    dark: '#0a3040',
    accent: '#3ec8f5',
    visor: '#041820',
    glass: '#7ae8ff',
    ink: '#f4f7fb',
    dim: '#8ab4c4',
  },
  'inspect-amber': {
    bg: '#0c0905',
    bay: '#1a1208',
    plate: '#d4a03a',
    dark: '#4a2808',
    accent: '#ffcc55',
    visor: '#1a0c04',
    glass: '#ffe08a',
    ink: '#fff8e8',
    dim: '#c4a878',
  },
  'groover-violet': {
    bg: '#080510',
    bay: '#120818',
    plate: '#7a5ad0',
    dark: '#2a1850',
    accent: '#c4b0ff',
    visor: '#100818',
    glass: '#e0d0ff',
    ink: '#f6f2ff',
    dim: '#b8a8d8',
  },
  'overlay-steel': {
    bg: '#07090c',
    bay: '#101418',
    plate: '#8aa4b8',
    dark: '#243038',
    accent: '#c8d8e4',
    visor: '#101418',
    glass: '#e8f0f4',
    ink: '#f4f7fb',
    dim: '#9ab0b8',
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
  if (kind === 1) {
    return `<g id="bay" data-bay="1"><rect width="512" height="512" fill="${pal.bg}"/><rect x="28" y="28" width="456" height="456" fill="${pal.bay}"/><rect x="40" y="36" width="432" height="10" fill="${pal.accent}" opacity="0.35"/><rect x="384" y="88" width="44" height="260" fill="${pal.dark}"/><rect x="396" y="104" width="10" height="10" fill="${pal.accent}"/></g>`;
  }
  if (kind === 2) {
    return `<g id="bay" data-bay="2"><rect width="512" height="512" fill="${pal.bg}"/><rect x="28" y="28" width="456" height="456" fill="${pal.bay}"/><rect x="24" y="48" width="464" height="8" fill="${pal.accent}" opacity="0.3"/><rect x="72" y="92" width="32" height="200" fill="${pal.dark}"/></g>`;
  }
  return `<g id="bay" data-bay="0"><rect width="512" height="512" fill="${pal.bg}"/><rect x="28" y="28" width="456" height="456" fill="${pal.bay}"/><rect x="48" y="40" width="416" height="8" fill="${pal.accent}" opacity="0.35"/><rect x="400" y="88" width="36" height="220" fill="${pal.dark}"/><rect x="412" y="108" width="8" height="8" fill="${pal.accent}"/></g>`;
}

const FACE_FONT = 'Arial,Helvetica,sans-serif';

/** Visor is the face. All visor paths ymax ≤ 184. No brim. */
function hatSvg(hat: Hat, pal: Palette): string {
  if (hat === 'mill-cap') {
    return `<g id="hat" data-hat="mill-cap" data-mesh="hud-plate"><path d="M120 44H392L404 168H108Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="4"/><path d="M132 72H380V88H132Z" fill="${pal.dark}"/><path d="M140 92H372L360 148H152Z" fill="${pal.glass}" stroke="${pal.visor}" stroke-width="3"/><path d="M160 112H352V132H160Z" fill="${pal.dark}"/><path d="M108 160H404L388 184H124Z" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="2"/></g>`;
  }
  if (hat === 'constitution-visor') {
    return `<g id="hat" data-hat="constitution-visor" data-mesh="chevron"><path d="M256 32L376 92L360 176H152L136 92Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="4"/><path d="M256 52L340 100L328 164H184L172 100Z" fill="${pal.glass}"/><path d="M256 32L308 88L256 104L204 88Z" fill="${pal.accent}"/><path d="M152 168H360L348 184H164Z" fill="${pal.dark}"/></g>`;
  }
  if (hat === 'job-helm') {
    return `<g id="hat" data-hat="job-helm" data-mesh="dome"><path d="M112 168L132 64Q256 24 380 64L400 168Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="4"/><path d="M148 88Q256 52 364 88L364 144Q256 172 148 144Z" fill="${pal.glass}" stroke="${pal.visor}" stroke-width="3"/><path d="M176 108H336V128H176Z" fill="${pal.dark}"/><path d="M112 160H400L384 184H128Z" fill="${pal.dark}"/></g>`;
  }
  return `<g id="hat" data-hat="inspect-visor" data-mesh="twin-slits"><path d="M128 48H384L400 168H112Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="4"/><path d="M188 72H228V148H188Z" fill="${pal.glass}" stroke="${pal.visor}" stroke-width="3"/><path d="M284 72H324V148H284Z" fill="${pal.glass}" stroke="${pal.visor}" stroke-width="3"/><rect x="112" y="88" width="20" height="56" fill="${pal.dark}" stroke="${pal.accent}"/><rect x="380" y="88" width="20" height="56" fill="${pal.dark}" stroke="${pal.accent}"/><path d="M112 160H400L384 184H128Z" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="2"/></g>`;
}

function collarSvg(pal: Palette, banner: string): string {
  return `<g id="collar"><path d="M104 184H408L388 228H124Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="4"/><path d="M136 196H376V216H136Z" fill="${pal.dark}"/><rect x="144" y="198" width="10" height="16" fill="${pal.accent}"/><rect x="358" y="198" width="10" height="16" fill="${pal.accent}"/><text x="256" y="212" text-anchor="middle" fill="${pal.ink}" font-family="${FACE_FONT}" font-size="14" font-weight="700">${banner}</text></g>`;
}

function chassisSvg(armor: Armor, pal: Palette, label: string): string {
  if (armor === 'ribbed') {
    return `<g id="chassis" data-armor="ribbed"><path d="M120 228H392L416 308L368 416H144L96 308Z" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="4"/><path d="M152 244H360L380 312L356 400H156L132 312Z" fill="${pal.plate}"/><rect x="176" y="256" width="160" height="40" rx="4" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="2"/><text x="256" y="282" text-anchor="middle" fill="${pal.ink}" font-family="${FACE_FONT}" font-size="18" font-weight="700">${label}</text><rect x="184" y="308" width="144" height="16" fill="${pal.dark}"/><rect x="184" y="330" width="144" height="16" fill="${pal.dark}"/><rect x="184" y="352" width="144" height="16" fill="${pal.dark}"/><rect x="184" y="374" width="144" height="16" fill="${pal.dark}"/><path d="M120 252L152 244L152 324L104 336Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="3"/><path d="M392 252L360 244L360 324L408 336Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="3"/></g>`;
  }
  return `<g id="chassis" data-armor="hex-gem"><path d="M116 240L256 224L396 240L416 328L256 420L96 328Z" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="4"/><path d="M148 256L256 240L364 256L380 324L256 396L132 324Z" fill="${pal.plate}"/><path d="M256 272L322 310L294 368L218 368L190 310Z" fill="${pal.accent}"/><path d="M256 288L306 316L286 356L226 356L206 316Z" fill="${pal.glass}"/><rect x="196" y="248" width="120" height="32" rx="3" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="2"/><text x="256" y="270" text-anchor="middle" fill="${pal.ink}" font-family="${FACE_FONT}" font-size="16" font-weight="700">${label}</text></g>`;
}

function packCores(pack: string, pal: Palette): string {
  if (pack !== '0xray-suit') return '';
  return `<g id="mill-inspect-cores" data-pack="0xray-suit"><circle cx="176" cy="330" r="28" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="3"/><circle cx="176" cy="330" r="12" fill="${pal.accent}"/><text x="176" y="378" text-anchor="middle" fill="${pal.ink}" font-family="${FACE_FONT}" font-size="11">MILL</text><circle cx="336" cy="330" r="28" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="3"/><circle cx="336" cy="330" r="12" fill="${pal.accent}"/><text x="336" y="378" text-anchor="middle" fill="${pal.ink}" font-family="${FACE_FONT}" font-size="11">INSPECT</text><path d="M204 330H308" stroke="${pal.accent}" stroke-width="3"/></g>`;
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
  const levelName =
    typeof view.level === 'number' && view.level >= 0 && view.level < GRVR_LEVEL_NAMES.length
      ? GRVR_LEVEL_NAMES[view.level]
      : '';
  const hudLine1 = levelName
    ? `#${tokenId} ${packLabel} · ${levelName}`
    : `#${tokenId} ${packLabel}`;
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" data-pack="${packLabel}" data-variant="${traits.variant}" data-hat="${traits.hat}" data-colorway="${traits.colorway}" data-armor="${armor}">${baySvg(pal, view.dna || '')}${hatSvg(traits.hat, pal)}${collarSvg(pal, banner)}${chassisSvg(armor, pal, plateLabel)}${packCores(pack, pal)}<g id="hud"><rect x="32" y="428" width="448" height="56" fill="${pal.bg}" stroke="${pal.accent}" stroke-width="2"/><text x="48" y="450" fill="${pal.ink}" font-family="${FACE_FONT}" font-size="13">${hudLine1}</text><text x="48" y="470" fill="${pal.dim}" font-family="${FACE_FONT}" font-size="11">${did} · ${dnaShort} · v${traits.variant}</text></g></svg>`;
}
