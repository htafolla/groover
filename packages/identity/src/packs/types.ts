/**
 * A GRVR pack adapter hashes one schema into bytes32 DNA.
 * New schemas land as a file in this directory and a register() call — a Groover PR.
 * The chain does not know the schema; it only stores pack + dna.
 */
export interface PackResolveInput {
  did: string;
  inventory?: Record<string, unknown>;
  inspect?: { ok?: boolean; dna?: string | null };
  payload?: Record<string, unknown>;
}

export interface PackAdapter {
  /** On-chain `pack` string, ≤ 64 bytes, no control chars. */
  pack: string;
  description: string;
  resolveDna(input: PackResolveInput): `0x${string}`;
}
