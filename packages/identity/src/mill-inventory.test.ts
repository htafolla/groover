import {describe, expect, it} from 'vitest';
import {millInventoryDna} from './packs/xray-suit.js';
import {
  buildFoundryInventory,
  lockedMillPlantSkills,
  receiptInspect,
} from './mill-inventory.js';

const millFields = {
  millName: '@0xray/foundry',
  millVersion: '0.1.9',
  suit: 'fastened' as const,
  costume: false,
  params: {
    codex: 'xray/codex.json',
    features: 'xray/features.json',
    config: 'xray/config.json',
    skills: 'src/skills',
    agents: 'src/opencode/agents',
    agentsCard: 'xray/AGENTS.md',
  },
  treeSkillsRaw: '',
  treeAgentsRaw: '',
  millPlantSkillsExtra: '',
  millPlantAgentsRaw: 'mill.yml, inspect.yml',
  constitution: false,
  features: false,
  config: false,
  agentsCard: false,
};

describe('mill factory inventory', () => {
  it('matches mill canonical DNA for the mill-dna fixture', () => {
    expect(
      millInventoryDna({consumer: {name: 'acme', version: '1.0.0'}, suit: 'overlay'}),
    ).toBe('0x8e4801128164478c23726a44b13e6b5bebb9187050ad484495a0ea4718b44424');
  });

  it('locks mill+inspect at the front of millPlant.skills', () => {
    expect(lockedMillPlantSkills('')).toEqual(['mill', 'inspect']);
    expect(lockedMillPlantSkills('mill, inspect, mill')).toEqual(['mill', 'inspect']);
    expect(lockedMillPlantSkills('enforcer')).toEqual(['mill', 'inspect', 'enforcer']);
  });

  it('receipt inspect fails without consumer identity', () => {
    const inventory = buildFoundryInventory({
      ...millFields,
      consumerName: '',
      consumerVersion: '',
    });
    expect(receiptInspect(inventory).ok).toBe(false);
    expect(receiptInspect(inventory).detail).toMatch(/consumer/);
  });

  it('receipt inspect passes for mill+inspect fastened consumer', () => {
    const inventory = buildFoundryInventory({
      ...millFields,
      consumerName: 'acme-app',
      consumerVersion: '1.0.0',
      features: true,
      config: true,
    });
    expect(receiptInspect(inventory).ok).toBe(true);
    expect(inventory.millPlant.skills).toEqual(['mill', 'inspect']);
    expect(inventory.facets.features).toBe(true);
    expect(inventory.dna).toMatch(/^0x[0-9a-f]{64}$/);
    expect(millInventoryDna({...inventory, mintedAt: '2099-01-01T00:00:00.000Z'})).toBe(
      inventory.dna,
    );
  });

  it('costume suit forces costume true', () => {
    const inventory = buildFoundryInventory({
      ...millFields,
      consumerName: 'acme-app',
      consumerVersion: '1.0.0',
      suit: 'costume',
      costume: false,
    });
    expect(inventory.costume).toBe(true);
    expect(inventory.suit).toBe('costume');
  });
});
