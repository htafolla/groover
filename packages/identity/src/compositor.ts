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

/** Visor is the face. Housing + recessed cavity + glass. ymax ≤ 176. No brim. */
function hatSvg(hat: Hat, pal: Palette): string {
  if (hat === 'mill-cap') {
    return `<g id="hat" data-hat="mill-cap" data-mesh="hud-plate" data-cavity="1"><path d="M108 40H404L416 164H96Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="4"/><path d="M128 56H384L396 152H116Z" fill="${pal.dark}"/><path d="M140 88H372L360 144H152Z" fill="${pal.glass}" stroke="${pal.visor}" stroke-width="3"/><path d="M148 92H220L200 108H156Z" fill="${pal.ink}" opacity="0.35"/><path d="M168 108H344V128H168Z" fill="${pal.dark}"/><path d="M108 56H128V152H108Z" fill="${pal.plate}"/><path d="M384 56H404V152H384Z" fill="${pal.plate}"/><path d="M96 156H416L400 176H112Z" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="2"/></g>`;
  }
  if (hat === 'constitution-visor') {
    return `<g id="hat" data-hat="constitution-visor" data-mesh="chevron" data-cavity="1"><path d="M256 28L384 88L368 168H144L128 88Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="4"/><path d="M256 48L356 96L344 156H168L156 96Z" fill="${pal.dark}"/><path d="M256 64L332 104L320 148H192L180 104Z" fill="${pal.glass}"/><path d="M256 68L292 92L256 104L220 92Z" fill="${pal.ink}" opacity="0.35"/><path d="M256 28L312 84L256 100L200 84Z" fill="${pal.accent}"/><path d="M144 160H368L352 176H160Z" fill="${pal.dark}"/></g>`;
  }
  if (hat === 'job-helm') {
    return `<g id="hat" data-hat="job-helm" data-mesh="dome" data-cavity="1"><path d="M104 168L124 52Q256 12 388 52L408 168Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="4"/><path d="M128 160L144 68Q256 32 368 68L384 160Z" fill="${pal.dark}"/><path d="M148 84Q256 48 364 84L364 136Q256 164 148 136Z" fill="${pal.glass}" stroke="${pal.visor}" stroke-width="3"/><path d="M164 88Q220 64 268 84L248 100Q200 108 164 96Z" fill="${pal.ink}" opacity="0.4"/><path d="M180 108H332V124H180Z" fill="${pal.dark}"/><path d="M104 156H408L392 176H120Z" fill="${pal.dark}"/></g>`;
  }
  return `<g id="hat" data-hat="inspect-visor" data-mesh="twin-slits" data-cavity="1"><path d="M116 44H396L412 164H100Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="4"/><path d="M136 60H376L388 152H124Z" fill="${pal.dark}"/><path d="M176 76H224V144H176Z" fill="${pal.glass}" stroke="${pal.visor}" stroke-width="3"/><path d="M288 76H336V144H288Z" fill="${pal.glass}" stroke="${pal.visor}" stroke-width="3"/><path d="M180 80H208L196 96H184Z" fill="${pal.ink}" opacity="0.35"/><path d="M292 80H320L308 96H296Z" fill="${pal.ink}" opacity="0.35"/><rect x="100" y="84" width="24" height="60" fill="${pal.plate}" stroke="${pal.accent}"/><rect x="388" y="84" width="24" height="60" fill="${pal.plate}" stroke="${pal.accent}"/><path d="M100 156H412L396 176H116Z" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="2"/></g>`;
}

function collarSvg(pal: Palette, banner: string): string {
  return `<g id="collar"><path d="M88 168H424L396 240H116Z" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="4"/><path d="M112 176H400L380 228H132Z" fill="${pal.plate}"/><path d="M148 188H364V216H148Z" fill="${pal.dark}"/><rect x="156" y="192" width="12" height="20" fill="${pal.accent}"/><rect x="344" y="192" width="12" height="20" fill="${pal.accent}"/><text x="256" y="210" text-anchor="middle" fill="${pal.ink}" font-family="${FACE_FONT}" font-size="14" font-weight="700">${banner}</text></g>`;
}

function chassisSvg(armor: Armor, pal: Palette, label: string): string {
  if (armor === 'ribbed') {
    return `<g id="chassis" data-armor="ribbed"><path d="M64 244L128 220L160 236V328L80 352Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="3"/><path d="M448 244L384 220L352 236V328L432 352Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="3"/><path d="M128 228H384L416 312L360 420H152L96 312Z" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="4"/><path d="M156 244H356L380 312L348 400H164L136 312Z" fill="${pal.plate}"/><path d="M164 248L236 252L220 300L164 292Z" fill="${pal.glass}" opacity="0.35"/><rect x="176" y="256" width="160" height="36" rx="4" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="2"/><text x="256" y="280" text-anchor="middle" fill="${pal.ink}" font-family="${FACE_FONT}" font-size="18" font-weight="700">${label}</text><rect x="184" y="308" width="144" height="14" fill="${pal.dark}"/><rect x="184" y="328" width="144" height="14" fill="${pal.dark}"/><rect x="184" y="348" width="144" height="14" fill="${pal.dark}"/><rect x="184" y="368" width="144" height="14" fill="${pal.dark}"/></g>`;
  }
  return `<g id="chassis" data-armor="hex-gem"><path d="M60 248L132 216L164 236V332L76 356Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="3"/><path d="M452 248L380 216L348 236V332L436 356Z" fill="${pal.plate}" stroke="${pal.accent}" stroke-width="3"/><path d="M132 232H380L412 320L352 424H160L100 320Z" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="4"/><path d="M160 248H352L376 316L340 404H172L136 316Z" fill="${pal.plate}"/><path d="M168 252L248 256L228 312L168 300Z" fill="${pal.glass}" opacity="0.4"/><rect x="196" y="252" width="120" height="32" rx="3" fill="${pal.dark}" stroke="${pal.accent}" stroke-width="2"/><text x="256" y="274" text-anchor="middle" fill="${pal.ink}" font-family="${FACE_FONT}" font-size="16" font-weight="700">${label}</text><path d="M256 308L318 348L292 400L220 400L194 348Z" fill="${pal.accent}"/><path d="M256 324L300 352L282 388L230 388L212 352Z" fill="${pal.glass}"/></g>`;
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
