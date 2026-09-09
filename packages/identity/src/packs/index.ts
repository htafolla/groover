/**
 * Builtin GRVR pack adapters. A new schema is a Groover PR:
 *   1. packages/identity/src/packs/<id>.ts implementing PackAdapter
 *   2. registerPackAdapter(...) in this file
 * MCP mint_suit then accepts that pack id. No contract change.
 */
import { grooverIdentityPack } from './groover-identity.js';
import { registerPackAdapter } from './registry.js';
import { xraySuitPack } from './xray-suit.js';

registerPackAdapter(grooverIdentityPack);
registerPackAdapter(xraySuitPack);

export type { PackAdapter, PackResolveInput } from './types.js';
export { getPackAdapter, listPackAdapters, listPackIds, registerPackAdapter } from './registry.js';
export { millInventoryDna } from './xray-suit.js';
