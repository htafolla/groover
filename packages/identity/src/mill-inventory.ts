import { millInventoryDna } from './packs/xray-suit.js';

export const DEFAULT_MILL_PARAMS = {
  codex: 'xray/codex.json',
  features: 'xray/features.json',
  config: 'xray/config.json',
  skills: 'src/skills',
  agents: 'src/opencode/agents',
  agentsCard: 'xray/AGENTS.md',
} as const;

export const DEFAULT_MILL_AGENTS = ['mill.yml', 'inspect.yml'] as const;

export type SuitKind = 'fastened' | 'overlay' | 'costume';

export type FoundryInventory = {
  mill: { name: string; version: string };
  consumer: { name: string; version: string };
  suit: SuitKind;
  params: {
    codex: string;
    features: string;
    config: string;
    skills: string;
    agents: string;
    agentsCard: string;
  };
  tree: { skills: string[]; agents: string[] };
  millPlant: { skills: string[]; agents: string[] };
  costume: boolean;
  facets: {
    constitution: boolean;
    features: boolean;
    config: boolean;
    agentsCard: boolean;
    skills: string[];
    agents: string[];
  };
  dna?: string;
};

export function splitList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function lockedMillPlantSkills(extraRaw: string): string[] {
  const extra = splitList(extraRaw).filter(
    (name) => name !== 'mill' && name !== 'inspect',
  );
  return ['mill', 'inspect', ...extra];
}

export function buildFoundryInventory(input: {
  consumerName: string;
  consumerVersion: string;
  millName: string;
  millVersion: string;
  suit: SuitKind;
  costume: boolean;
  params: FoundryInventory['params'];
  treeSkillsRaw: string;
  treeAgentsRaw: string;
  millPlantSkillsExtra: string;
  millPlantAgentsRaw: string;
  constitution: boolean;
  features: boolean;
  config: boolean;
  agentsCard: boolean;
}): FoundryInventory {
  const treeSkills = splitList(input.treeSkillsRaw);
  const treeAgents = splitList(input.treeAgentsRaw);
  const millPlantAgents = splitList(input.millPlantAgentsRaw);
  const millPlantSkills = lockedMillPlantSkills(input.millPlantSkillsExtra);
  const costume = input.suit === 'costume' ? true : input.costume;
  const inventory: FoundryInventory = {
    mill: { name: input.millName.trim(), version: input.millVersion.trim() },
    consumer: {
      name: input.consumerName.trim(),
      version: input.consumerVersion.trim(),
    },
    suit: input.suit,
    params: input.params,
    tree: { skills: treeSkills, agents: treeAgents },
    millPlant: { skills: millPlantSkills, agents: millPlantAgents },
    costume,
    facets: {
      constitution: input.constitution,
      features: input.features,
      config: input.config,
      agentsCard: input.agentsCard,
      skills: treeSkills,
      agents: treeAgents,
    },
  };
  inventory.dna = millInventoryDna(inventory);
  return inventory;
}

export function receiptInspect(inventory: FoundryInventory): {
  ok: boolean;
  detail: string | null;
} {
  if (!inventory.consumer.name || !inventory.consumer.version) {
    return { ok: false, detail: 'consumer.name and consumer.version required' };
  }
  if (!inventory.mill.name || !inventory.mill.version) {
    return { ok: false, detail: 'mill.name and mill.version required' };
  }
  const skills = inventory.millPlant.skills;
  if (!skills.includes('mill') || !skills.includes('inspect')) {
    return { ok: false, detail: 'millPlant.skills must include mill and inspect' };
  }
  if (
    inventory.suit !== 'fastened' &&
    inventory.suit !== 'overlay' &&
    inventory.suit !== 'costume'
  ) {
    return { ok: false, detail: 'suit must be fastened, overlay, or costume' };
  }
  return { ok: true, detail: null };
}
