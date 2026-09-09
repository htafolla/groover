/** Builtin pack adapters. Register additional packs here. */
import { grooverIdentityPack } from './groover-identity.js';
import { registerPackAdapter } from './registry.js';
import { xraySuitPack } from './xray-suit.js';

registerPackAdapter(grooverIdentityPack);
registerPackAdapter(xraySuitPack);

export type { PackAdapter, PackResolveInput } from './types.js';
export { getPackAdapter, listPackAdapters, listPackIds, registerPackAdapter } from './registry.js';
export { millInventoryDna } from './xray-suit.js';
