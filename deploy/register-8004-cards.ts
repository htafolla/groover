/**
 * Website static URLs for ERC-8004 registration files.
 * Host matches live grvr-2 cards. Do not invent a second file base.
 */
export const WEBSITE_FILE_BASE =
  'https://website-production-c0da.up.railway.app/identity/registration';

export type RegistrationCard = {
  tokenId: string;
  agentId: string;
  v1: string;
  v2: string;
};

export const REGISTRATION_CARDS: Record<string, RegistrationCard> = {
  '1': {
    tokenId: '1',
    agentId: '86556',
    v1: `${WEBSITE_FILE_BASE}/grvr-1-v1.json`,
    v2: `${WEBSITE_FILE_BASE}/grvr-1-v2.json`,
  },
  '2': {
    tokenId: '2',
    agentId: '86025',
    v1: `${WEBSITE_FILE_BASE}/grvr-2-v1.json`,
    v2: `${WEBSITE_FILE_BASE}/grvr-2-v2.json`,
  },
};

const AGENT_ID_TO_TOKEN: Record<string, string> = {
  '86556': '1',
  '86025': '2',
  '86024': '2',
};

export function tokenIdFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.GRVR_TOKEN_ID?.trim();
  if (explicit) return explicit;
  const fromAgent = env.AGENT_ID ? AGENT_ID_TO_TOKEN[env.AGENT_ID.trim()] : undefined;
  return fromAgent ?? '2';
}

export function resolveRegistrationCard(
  env: NodeJS.ProcessEnv = process.env,
): RegistrationCard {
  const tokenId = tokenIdFromEnv(env);
  const card = REGISTRATION_CARDS[tokenId];
  if (!card) {
    throw new Error(`unknown GRVR_TOKEN_ID ${tokenId} (expected 1 or 2)`);
  }
  return card;
}

export function resolveSetUriTarget(env: NodeJS.ProcessEnv = process.env): {
  agentId: string;
  uri: string;
  card: RegistrationCard;
} {
  const card = resolveRegistrationCard(env);
  const agentId = env.AGENT_ID?.trim() || card.agentId;
  if (!/^\d+$/.test(agentId)) {
    throw new Error('AGENT_ID must be a decimal agent id');
  }
  const uri = env.AGENT_URI?.trim() || card.v2;
  return { agentId, uri, card };
}
