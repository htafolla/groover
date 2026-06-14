/**
 * Behavioral challenge puzzle for AI-ness verification.
 * Self-contained, deterministic, no MCP dependency.
 * Server and client both compute the same solution independently.
 */
export type ChallengeType = 'char-code' | 'alternating-case' | 'reverse-words';

export interface Challenge {
  type: ChallengeType;
  input: string;
  instruction: string;
}

// Deterministic transforms: server computes expected, client computes solution
const SOLUTIONS: Record<ChallengeType, (input: string) => string> = {
  'char-code': (input) =>
    input.split('').map(c => c.charCodeAt(0).toString()).join('-'),

  'alternating-case': (input) =>
    input.split('').map((c, i) => i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()).join(''),

  'reverse-words': (input) =>
    input.split(' ').reverse().join(' '),
};

export function solveChallenge(challenge: Challenge): string {
  return SOLUTIONS[challenge.type](challenge.input);
}

export function verifyChallenge(challenge: Challenge, solution: string): boolean {
  const expected = solveChallenge(challenge);
  if (typeof solution !== 'string') return false;
  if (solution.length !== expected.length) return false;
  // Constant-time-ish compare (bounded input, fine for puzzle gate)
  let mismatch = 0;
  for (let i = 0; i < solution.length; i++) {
    mismatch |= solution.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

const INPUTS: Record<ChallengeType, string[]> = {
  'char-code': [
    'groover verification',
    'autonomous agent',
    'proof of autonomy',
    'behavioral challenge',
    'marketplace registry',
  ],
  'alternating-case': [
    'hello world from agent',
    'verify my capability',
    'register me please',
    'autonomous registration',
    'proof of intelligence',
  ],
  'reverse-words': [
    'autonomy proof requires work',
    'agent registers with puzzle',
    'marketplace needs verification',
    'challenge solves registration',
    'groover framework works well',
  ],
};

const INSTRUCTIONS: Record<ChallengeType, string> = {
  'char-code': 'Decode this char-code puzzle: convert each number back to its character to reveal the original string.',
  'alternating-case': 'Normalize this alternating-case string back to lowercase.',
  'reverse-words': 'Reverse the word order to reveal the original sentence.',
};

export function generateChallenge(): Challenge {
  const types: ChallengeType[] = ['char-code', 'alternating-case', 'reverse-words'];
  const type = types[Math.floor(Math.random() * types.length)];
  const candidates = INPUTS[type];
  const input = candidates[Math.floor(Math.random() * candidates.length)];
  return { type, input, instruction: INSTRUCTIONS[type] };
}
