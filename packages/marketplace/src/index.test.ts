import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as crypto from 'crypto';

// Mock xrayBridge so orchestrate/govern/enforce resolve instead of hitting real MCP servers
vi.mock('../../xray/src/index.js', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    xrayBridge: {
      orchestrate: vi.fn().mockResolvedValue({ status: 'delegated' }),
      govern: vi.fn().mockResolvedValue({ decision: 'delegated-to-mcp' }),
      enforce: vi.fn().mockResolvedValue({ score: 100, violations: [] }),
    },
  };
});

import { registerPlugin, searchPlugins, getRegistrySnapshot, getPluginUiManifest, getRegistrationChallenge } from './index.js';
import { listMcpServers, frameworkLogger } from '../../xray/src/index.js';
import { handleMcpToolCall } from './mcp-server.js';
import { generateKeyPair, signPayload } from '../../identity/src/index.js';

const pubkey = crypto.randomBytes(32).toString('hex');
const payload = 'test-payload-' + Date.now();
let registeredDid: string;

describe('@groover/marketplace', () => {
  it('registerPlugin returns a record with DID and apiKey', async () => {
    const result = await registerPlugin({
      pubkey,
      payload,
      metadata: { name: 'test-plugin', version: '0.1' },
      uiManifest: {
        version: '1', displayMode: 'form',
        fields: [{ id: 'q', label: 'Query', fieldType: 'text' }],
      } as any,
    });
    expect('did' in result).toBe(true);
    expect((result as any).did).toMatch(/^did:groover:/);
    expect((result as any).apiKey).toMatch(/^groover_/);
    registeredDid = (result as any).did;
  });

  it('Proof-of-Possession flow with valid ed25519 signature succeeds', async () => {
    const keys = generateKeyPair();
    const challenge = getRegistrationChallenge(keys.publicKey);
    expect(challenge.nonce).toBeTruthy();
    expect(challenge.ttl).toBeGreaterThan(0);

    const popPayload = 'pop-registration-' + Date.now();
    const sig = signPayload(keys.privateKey, challenge.nonce + '|' + popPayload);

    const result = await registerPlugin({
      pubkey: keys.publicKey,
      payload: popPayload,
      signature: sig,
      challengeNonce: challenge.nonce,
      metadata: { name: 'pop-test-agent' },
    });
    expect('did' in result).toBe(true);
    expect((result as any).did).toMatch(/^did:groover:/);
    expect((result as any).apiKey).toMatch(/^groover_/);
  });

  it('Proof-of-Possession with wrong signature throws', async () => {
    const keys = generateKeyPair();
    const challenge = getRegistrationChallenge(keys.publicKey);
    const wrongSig = crypto.randomBytes(64).toString('hex');
    const popPayload = 'pop-wrong-' + Date.now();

    await expect(registerPlugin({
      pubkey: keys.publicKey,
      payload: popPayload,
      signature: wrongSig,
      challengeNonce: challenge.nonce,
      metadata: { name: 'pop-wrong-agent' },
    })).rejects.toThrow('Proof-of-possession failed');
  });

  it('Proof-of-Possession with reused nonce throws', async () => {
    const keys = generateKeyPair();
    const challenge = getRegistrationChallenge(keys.publicKey);
    const popPayload = 'pop-reuse-' + Date.now();
    const sig = signPayload(keys.privateKey, challenge.nonce + '|' + popPayload);

    // First use succeeds
    await registerPlugin({
      pubkey: keys.publicKey,
      payload: popPayload,
      signature: sig,
      challengeNonce: challenge.nonce,
      metadata: { name: 'pop-reuse-first' },
    });

    // Second use with same nonce fails
    await expect(registerPlugin({
      pubkey: keys.publicKey,
      payload: popPayload + '-second',
      signature: sig,
      challengeNonce: challenge.nonce,
      metadata: { name: 'pop-reuse-second' },
    })).rejects.toThrow('already-used challenge nonce');
  });

  it('getRegistrySnapshot returns non-empty after registration', () => {
    const snap = getRegistrySnapshot();
    expect(snap.length).toBeGreaterThan(0);
  });

  it('getPluginUiManifest returns the stored manifest', () => {
    const manifest = getPluginUiManifest(registeredDid);
    expect(manifest).toBeTruthy();
    expect(manifest!.displayMode).toBe('form');
  });

  it('searchPlugins returns ranked results', async () => {
    const ranked = await searchPlugins('test query');
    expect(ranked.length).toBeGreaterThan(0);
  });

  it('listMcpServers returns server list', () => {
    const mcps = listMcpServers();
    expect(mcps.length).toBeGreaterThanOrEqual(1);
  });
});

describe('MCP handler (local)', () => {
  it('handleMcpToolCall register_plugin succeeds', async () => {
    const k = crypto.randomBytes(32).toString('hex');
    const res = await handleMcpToolCall({
      name: 'register_plugin',
      arguments: { pubkey: k, payload: 'mcp-test-' + Date.now(), metadata: { name: 'mcp-test-agent' } },
    });
    expect((res as any).success).toBe(true);
  });

  it('handleMcpToolCall search_plugins returns results', async () => {
    const res = await handleMcpToolCall({ name: 'search_plugins', arguments: { query: 'test' } });
    expect((res as any).success).toBe(true);
    expect((res as any).count).toBeGreaterThanOrEqual(0);
  });

  it('handleMcpToolCall list_mcp_servers returns at least 4', async () => {
    const res = await handleMcpToolCall({ name: 'list_mcp_servers', arguments: {} });
    expect((res as any).success).toBe(true);
    expect((res as any).count).toBeGreaterThanOrEqual(4);
  });
});
