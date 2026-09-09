/** Pack adapter: one schema → bytes32 DNA. */
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
