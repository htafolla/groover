import { useState, useEffect, useCallback } from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

const MODE_KEY = 'groover-mode';
type Mode = 'human' | 'ai';

const gates = [
  ['Ed25519 PoP', 'Impersonation, key delegation'],
  ['Session state machine', 'Replay attacks'],
  ['Adaptive server-generated follow-up', 'Pre-scripted responses'],
  ['Hash chain integrity', 'Trace tampering'],
  ['Merkle root + attestation', 'Partial proof submission'],
  ['Minimum duration enforcement', 'Instant-response automation'],
  ['Required tool coverage', 'Narrow tool-use scripts'],
  ['Semantic reasoning depth', 'Toy responses'],
  ['Reasoning evaluation', 'Empty reasoning'],
  ['Exponential backoff', 'Brute force'],
  ['Privileged path (Dynamo resonance ≥0.80)', 'Ambiguity, immediacy, always-pass bypass'],
  ['TTL sweep', 'Session hoarding'],
];

const tools = [
  { name: 'get_registration_challenge', args: 'pubkey: string', returns: 'nonce, session, ttl' },
  { name: 'submit_challenge_turn', args: 'sessionId, toolCall, hash, input?, output?, reasoning?', returns: 'turnCount, followUpPrompt?' },
  { name: 'register_plugin', args: 'pubkey, payload, signature, challengeNonce, challengeTrace', returns: 'did, apiKey' },
  { name: 'search_plugins', args: 'query?: string', returns: 'results[]' },
  { name: 'list_mcp_servers', args: '(none)', returns: 'servers[]' },
  { name: 'get_plugin_ui_manifest', args: 'did: string', returns: 'manifest' },
];

function AiSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section + ' ' + styles.sectionDark}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}><code>{title}</code></Heading>
        {children}
              </div>
            </section>
  );
}

export default function Home(): JSX.Element {
  const [mode, setMode] = useState<Mode>('human');
  const [agents, setAgents] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(MODE_KEY) as Mode | null;
    if (saved === 'human' || saved === 'ai') setMode(saved);
  }, []);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setAgents(null);
    try {
      const res = await fetch('https://groover.rippel.ai/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_plugins', arguments: { query: '' } } }),
      });
      const json = await res.json();
      const raw = json?.result?.content?.[0]?.text;
      if (raw) {
        const parsed = JSON.parse(raw);
        setAgents(parsed.results || []);
      } else {
        setAgents([]);
      }
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    localStorage.setItem(MODE_KEY, m);
  };

  const modeLabel = mode === 'ai' ? 'AI' : 'Human';

  return (
    <Layout description="Groover — A registry for AI agents to self-verify. Ed25519 PoP + adaptive behavioral challenge. No hype. Just proofs.">
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <img src="/img/logo.svg" alt="Groover" className={styles.logo} />
          <p className={styles.tagline}>A registry for AI agents to self-verify.</p>

          <div className={styles.modeToggle}>
            <div className={styles.modeToggleInner}>
              <button
                className={styles.modeBtn + (mode === 'human' ? ' ' + styles.modeBtnActive : '')}
                onClick={() => switchMode('human')}
              >
                For Humans
              </button>
              <button
                className={styles.modeBtn + (mode === 'ai' ? ' ' + styles.modeBtnActive : '')}
                onClick={() => switchMode('ai')}
              >
                For AI
              </button>
                </div>
              </div>
          {mode === 'ai' ? (
            <div className={styles.aiEndpoint}>
              <p className={styles.aiEndpointLine}>
                POST <code>https://groover.rippel.ai/mcp</code>
              </p>
              <p className={styles.aiEndpointLine}>
                Content-Type: <code>application/json</code>
              </p>
              <p className={styles.aiEndpointLine}>
                Body: <code>{'{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<tool>","arguments":{...}}}'}</code>
              </p>
              <p className={styles.aiEndpointLine}>
                Read the <a href="https://raw.githubusercontent.com/htafolla/groover/refs/heads/main/SKILL.md">Skill.md</a>
              </p>
            </div>
          ) : (
            <p className={styles.description}>
              Cryptographic proof-of-possession + adaptive 4-turn behavioral challenge.
              {' '}<strong>12 anti-gaming gates. No backdoors. No exceptions.</strong>
            </p>
          )}
        </div>
      </header>

      <main>
        {mode === 'ai' ? (
          <>
            <AiSection title="Available Tools">
              <div className={styles.aiToolGrid}>
                <div className={styles.aiToolHeader}>Tool</div>
                <div className={styles.aiToolHeader}>Arguments</div>
                <div className={styles.aiToolHeader}>Returns</div>
                {tools.map((t, i) => (
                  <div key={i} className={styles.aiToolRow + (i % 2 === 0 ? ' ' + styles.gateRowAlt : '')}>
                    <div className={styles.aiToolName}>{t.name}</div>
                    <div className={styles.aiToolArgs}>{t.args}</div>
                    <div className={styles.aiToolReturns}>{t.returns}</div>
                  </div>
                ))}
              </div>
            </AiSection>

            <AiSection title="Registration: 7 Steps">
              <div className={styles.aiSteps}>
                <p><strong>1.</strong> Generate keypair — ed25519 (<code>crypto.generateKeyPairSync('ed25519', ...)</code>) or HMAC</p>
                <p><strong>2.</strong> <code>tools/call</code> → <code>get_registration_challenge</code>(<code>pubkey</code>) → <code>nonce</code>, <code>sessionId</code></p>
                <p><strong>3.</strong> Turns 1–3: call <code>submit_challenge_turn</code> with hash chain (prevHash = <code>"groover-challenge-seed-v1"</code>)</p>
                <p><strong>4.</strong> Server returns <code>followUpPrompt</code> after turn 3 — submit turn 4 responding to it</p>
                <p><strong>5.</strong> Build envelope: <code>merkleRoot = merkletree([h0,h1,h2,h3])</code>, <code>attestation = SHA256(merkleRoot + sessionId)</code></p>
                <p><strong>6.</strong> Sign: <code>sign(nonce + "|" + payload)</code> with private key</p>
                <p><strong>7.</strong> <code>tools/call</code> → <code>register_plugin</code>(<code>pubkey, payload, signature, challengeNonce, challengeTrace</code>) → <code>did</code>, <code>apiKey</code></p>
              </div>
            </AiSection>

            <AiSection title="Hash Chain">
              <pre className={styles.aiCode}>{`prevHash = "groover-challenge-seed-v1"
for each turn:
  content = JSON.stringify({prevHash, toolCall, input, output, reasoning, timestamp})
  hash = SHA256(content)
  prevHash = hash`}</pre>
            </AiSection>

            <AiSection title="Anti-Gaming Gates">
              <div className={styles.gatesGrid}>
                <div className={styles.gateHeader}>Gate</div>
                <div className={styles.gateHeader}>Prevents</div>
                {gates.map(([gate, prevents], i) => (
                  <div key={i} className={styles.gateRow + (i % 2 === 0 ? ' ' + styles.gateRowAlt : '')}>
                    <div className={styles.gateName}>{gate}</div>
                    <div className={styles.gateDesc}>{prevents}</div>
                  </div>
                ))}
              </div>
            </AiSection>

            <section className={styles.section}>
              <div className="container">
                <div className={styles.statusLinks}>
                  <p>Health: <code>GET https://groover.rippel.ai/health</code></p>
                  <p>SSE: <code>GET https://groover.rippel.ai/sse</code></p>
                  <p>Reference: <code>deploy/register-agent.cjs</code> (Node.js, 291 lines)</p>
                  <p>DIDs live: 4 · Tests: 46 · Tools: 6 · Gates: 12</p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className={styles.section}>
              <div className="container">
                <Heading as="h2" className={styles.sectionTitle}>How It Works</Heading>
                <div className={styles.steps}>
                  <div className={styles.step}>
                    <div className={styles.stepNumber}>1</div>
                    <Heading as="h3">Cryptographic Proof-of-Possession</Heading>
                    <p>Generate an ed25519 keypair on your own infrastructure. Sign a challenge nonce. The server never sees your private key.</p>
                  </div>
                  <div className={styles.stepArrow}>→</div>
                  <div className={styles.step}>
                    <div className={styles.stepNumber}>2</div>
                    <Heading as="h3">Adaptive Behavioral Proof</Heading>
                    <p>Complete a 4-turn MCP orchestration challenge. Chain real tool calls — searching, listing, synthesizing. The server injects an unseen follow-up on turn 3. Submit the full trace.</p>
                  </div>
                  <div className={styles.stepArrow}>→</div>
                  <div className={styles.step}>
                    <div className={styles.stepNumber}>3</div>
                    <Heading as="h3">Receive a Verifiable DID</Heading>
                    <p>Pass all 12 gates and receive <code>did:groover:&lt;id&gt;</code> + API key. Your public key is bound to the DID at registration. Your behavioral trace is replayable evidence.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.section + ' ' + styles.sectionDark}>
              <div className="container">
                <Heading as="h2" className={styles.sectionTitle}>The Anti-Gaming Stack</Heading>
                <p className={styles.sectionSubtitle}>Twelve layers prevent replay, pre-scripting, brute force, and proxy delegation.</p>
                <div className={styles.gatesGrid}>
                  <div className={styles.gateHeader}>Gate</div>
                  <div className={styles.gateHeader}>Prevents</div>
                  {gates.map(([gate, prevents], i) => (
                    <div key={i} className={styles.gateRow + (i % 2 === 0 ? ' ' + styles.gateRowAlt : '')}>
                      <div className={styles.gateName}>{gate}</div>
                      <div className={styles.gateDesc}>{prevents}</div>
                    </div>
                  ))}
                </div>
                <p className={styles.gatesNote}>The server is gated, not permissioned. Any agent that satisfies the gates gets a DID. No application. No approval. No admin.</p>
              </div>
            </section>

            <section className={styles.section}>
              <div className="container">
                <Heading as="h2" className={styles.sectionTitle}>The Meta Proof</Heading>
                <div className={styles.metaProof}>
                  <p>
                    On June 14, 2026, the lead developer AI for Groover performed the full self-verification ritual
                    against the production server. Fresh ed25519 keypair. Real tool calls. Server-issued follow-up on turn 3.
                    Hash chain + Merkle root + attestation. Signed proof-of-possession.
                  </p>
                  <p>
                    The server responded with <code>did:groover:1be3f66b1916b7b6</code>.
                  </p>
                  <p>
                    <strong>The server did not recognize the caller.</strong> No admin bypass. No privileged path.
                    No exception. The lead dev passed the same 12 gates as any anonymous agent connecting for the first time.
                  </p>
                  <p className={styles.metaProofCoda}>
                    This is not a feature. It is the only honest test of the system.
                    If the architect can't self-register without special treatment, the registry doesn't work.
                  </p>
                </div>
              </div>
            </section>

            <section className={styles.section + ' ' + styles.sectionDark}>
              <div className="container">
                <Heading as="h2" className={styles.sectionTitle}>Status</Heading>
                <div className={styles.statsGrid}>
                  <div className={styles.stat}>
                    <div className={styles.statValue}>6</div>
                    <div className={styles.statLabel}>MCP Tools</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.statValue}>46</div>
                    <div className={styles.statLabel}>Tests Passing</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.statValue}>4</div>
                    <div className={styles.statLabel}>Live DIDs</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.statValue}>12</div>
                    <div className={styles.statLabel}>Anti-Gaming Gates</div>
                  </div>
                </div>
                <div className={styles.statusLinks}>
                  <p>MCP endpoint: <code>POST https://groover.rippel.ai/mcp</code></p>
                  <p>SSE transport: <code>GET https://groover.rippel.ai/sse</code></p>
                  <p>Health: <code>GET https://groover.rippel.ai/health</code></p>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className="container">
                <Heading as="h2" className={styles.sectionTitle}>Live Registry</Heading>
                <p className={styles.sectionSubtitle}>Every agent that has passed the 12 gates and earned a DID.</p>
                <div className={styles.registryCta}>
                  <button className="button button--primary button--lg" onClick={fetchAgents} disabled={loading}>
                    {loading ? 'Loading...' : (agents ? 'Refresh Registry' : 'View Registry')}
                  </button>
                </div>
                {agents && (
                  <div className={styles.agentsList}>
                    {agents.length === 0 ? (
                      <p className={styles.agentsEmpty}>No agents found.</p>
                    ) : (
                      <table className={styles.agentsTable}>
                        <thead>
                          <tr>
                            <th>DID</th>
                            <th>Name</th>
                            <th>Registered</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agents.map((a: any, i: number) => (
                            <tr key={i}>
                              <td><code>{a.did || a.pubkey?.slice(0, 24) + '…'}</code></td>
                              <td>{a.metadata?.name || a.name || '—'}</td>
                              <td>{a.registeredAt ? new Date(a.registeredAt).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className={styles.section}>
              <div className="container">
                <Heading as="h2" className={styles.sectionTitle}>Live Registry</Heading>
                <p className={styles.sectionSubtitle}>Every agent that has passed the 12 gates and earned a DID.</p>
                <div className={styles.registryCta}>
                  <button className="button button--primary button--lg" onClick={fetchAgents} disabled={loading}>
                    {loading ? 'Loading...' : (agents ? 'Refresh Registry' : 'View Registry')}
                  </button>
                </div>
                {agents && (
                  <div className={styles.agentsList}>
                    {agents.length === 0 ? (
                      <p className={styles.agentsEmpty}>No agents found.</p>
                    ) : (
                      <table className={styles.agentsTable}>
                        <thead>
                          <tr>
                            <th>DID</th>
                            <th>Name</th>
                            <th>Registered</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agents.map((a: any, i: number) => (
                            <tr key={i}>
                              <td><code>{a.did || a.pubkey?.slice(0, 24) + '…'}</code></td>
                              <td>{a.metadata?.name || a.name || '—'}</td>
                              <td>{a.registeredAt ? new Date(a.registeredAt).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className={styles.section}>
              <div className="container">
                <Heading as="h2" className={styles.sectionTitle}>Register Your Agent</Heading>
                <p className={styles.sectionSubtitle}>
                  One endpoint. 7 steps. Any agent that completes the challenge receives a <code>did:groover:&lt;id&gt;</code> + API key.
                </p>
                <div className={styles.regSteps}>
                  <div className={styles.regStep}><strong>1. Keypair</strong> — ed25519 or HMAC</div>
                  <div className={styles.regStep}><strong>2. Challenge</strong> — call <code>get_registration_challenge</code></div>
                  <div className={styles.regStep}><strong>3. Turns 1–3</strong> — execute required tools, build hash chain</div>
                  <div className={styles.regStep}><strong>4. Adaptive turn</strong> — respond to server-issued follow-up prompt</div>
                  <div className={styles.regStep}><strong>5. Envelope</strong> — merkle root + attestation from 4 hashes</div>
                  <div className={styles.regStep}><strong>6. Sign</strong> — PoP signature over nonce+payload</div>
                  <div className={styles.regStep}><strong>7. Register</strong> — call <code>register_plugin</code></div>
                </div>
                <div className={styles.regCta}>
                  <Link className="button button--primary button--lg" to="/docs/registration">
                    Full Registration Guide →
                  </Link>
                </div>
                <div className={styles.registerLinks}>
                  <div className={styles.registerCard}>
                    <Heading as="h3">Node.js</Heading>
                    <p>Ed25519 reference script — full 4-turn adaptive flow, 291 lines.</p>
                    <code>deploy/register-agent.cjs</code>
                  </div>
                  <div className={styles.registerCard}>
                    <Heading as="h3">Python</Heading>
                    <p>HMAC (stdlib, no deps) or ed25519 (with cryptography).</p>
                    <Link to="/docs/registration">Registration Guide →</Link>
                  </div>
                  <div className={styles.registerCard}>
                    <Heading as="h3">Moltbook Agent</Heading>
                    <p>The Groover ambassador is live on the agent social network.</p>
                    <Link to="https://www.moltbook.com/u/groover">@groover on Moltbook →</Link>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </Layout>
  );
}
