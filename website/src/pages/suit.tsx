import {useMemo, useState} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import {
  COLORWAYS,
  HATS,
  composeIdentitySvg,
  variantFromTraits,
  type Colorway,
  type Hat,
} from '../lib/identity-compositor';
import {
  DEFAULT_CONFIG,
  DEFAULT_FEATURES,
  parseObjectJson,
  prettyJson,
  type FactoryConfig,
} from '../lib/mill-config';
import {
  DEFAULT_MILL_AGENTS,
  DEFAULT_MILL_PARAMS,
  buildFoundryInventory,
  receiptInspect,
  type SuitKind,
} from '../lib/mill-inventory';
import styles from './suit.module.css';

const MCP_URL = 'https://groover.rippel.ai/mcp';
const IMAGE_BASE =
  'https://registry-production-e2c4.up.railway.app/identity/token-image/';
const GRVR_V4 = '0xD892D6836ab138a5aE4365dcb05Adb296607d6f9';
const PREVIEW_DID = 'did:groover:aaaaaaaaaaaaaaaa';
const DEFAULT_PACK = '0xray-suit';

const CLI_LOAD = `tar xzf mill-plant.tgz
# factory-config.json from this page → repo root
node mill-plant/install.mjs --from factory-config.json
npm i -D 0xray@4.0.9
npx @0xray/foundry mint
npx @0xray/foundry inspect`;

const SAMPLE_SKILLS = ['extract', 'witness'];
const SAMPLE_AGENTS: string[] = [];
const SAMPLE_TREE_SKILLS: string[] = [];
const SAMPLE_TREE_AGENTS: string[] = [];

const SUIT_FIT_HELP: Record<SuitKind, string> = {
  fastened: 'Lean plant: mill + inspect only. Start here.',
  overlay: 'Your repo files win over mill defaults.',
  costume: 'Full 45-skill / 42-agent 0xray costume.',
};

function splitTokens(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function ChipInput(props: {
  label: string;
  hint?: string;
  value: string;
  onChange: (raw: string) => void;
  locked?: string[];
  placeholder?: string;
  samples?: string[];
}): JSX.Element {
  const [draft, setDraft] = useState('');
  const tokens = splitTokens(props.value);
  const locked = props.locked ?? [];
  const editable = tokens.filter((t) => !locked.includes(t));
  const commitDraft = () => {
    const fresh = splitTokens(draft).filter((t) => !tokens.includes(t));
    if (fresh.length > 0) props.onChange([...tokens, ...fresh].join(', '));
    setDraft('');
  };
  const removeToken = (token: string) => {
    props.onChange(tokens.filter((t) => t !== token).join(', '));
  };
  const addSample = (sample: string) => {
    if (!tokens.includes(sample)) props.onChange([...tokens, sample].join(', '));
  };
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{props.label}</span>
      {props.hint ? <span className={styles.fieldHint}>{props.hint}</span> : null}
      <div className={styles.chips}>
        {locked.map((name) => (
          <span key={`locked-${name}`} className={styles.chipLocked} title="Always planted">
            🔒 {name}
          </span>
        ))}
        {editable.map((name) => (
          <span key={name} className={styles.chip}>
            {name}
            <button
              type="button"
              className={styles.chipX}
              aria-label={`Remove ${name}`}
              onClick={() => removeToken(name)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className={styles.chipInput}
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(',')) {
              setDraft('');
              const fresh = splitTokens(v).filter((t) => !tokens.includes(t));
              if (fresh.length > 0) props.onChange([...tokens, ...fresh].join(', '));
            } else {
              setDraft(v);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
            }
          }}
          onBlur={commitDraft}
          placeholder={props.placeholder ?? 'type + Enter'}
        />
      </div>
      {props.samples && props.samples.length > 0 ? (
        <div className={styles.samplesRow}>
          <span className={styles.samplesLabel}>Examples:</span>
          {props.samples.map((s) => (
            <button
              key={s}
              type="button"
              className={styles.sampleChip}
              onClick={() => addSample(s)}
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type MintPayload = {
  success?: boolean;
  dryRun?: boolean;
  tokenId?: string;
  txHash?: string;
  dna?: string;
  variant?: number;
  level?: number;
  pack?: string;
};

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function callMintSuit(args: Record<string, unknown>): Promise<MintPayload> {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {name: 'mint_suit', arguments: args},
    }),
  });
  const json = (await res.json()) as {
    error?: {message?: string};
    result?: {content?: Array<{text?: string}>};
  };
  if (json.error?.message) throw new Error(json.error.message);
  const raw = json.result?.content?.[0]?.text;
  if (!raw) throw new Error('mint_suit returned no payload');
  return JSON.parse(raw) as MintPayload;
}

export default function SuitFactoryPage(): JSX.Element {
  const [consumerName, setConsumerName] = useState('');
  const [consumerVersion, setConsumerVersion] = useState('');
  const [millName, setMillName] = useState('@0xray/foundry');
  const [millVersion, setMillVersion] = useState('0.1.9');
  const [suit, setSuit] = useState<SuitKind>('fastened');
  const [costume, setCostume] = useState(false);
  const [codexPath, setCodexPath] = useState<string>(DEFAULT_MILL_PARAMS.codex);
  const [featuresPath, setFeaturesPath] = useState<string>(DEFAULT_MILL_PARAMS.features);
  const [configPath, setConfigPath] = useState<string>(DEFAULT_MILL_PARAMS.config);
  const [skillsPath, setSkillsPath] = useState<string>(DEFAULT_MILL_PARAMS.skills);
  const [agentsPath, setAgentsPath] = useState<string>(DEFAULT_MILL_PARAMS.agents);
  const [agentsCardPath, setAgentsCardPath] = useState<string>(
    DEFAULT_MILL_PARAMS.agentsCard,
  );
  const [treeSkillsRaw, setTreeSkillsRaw] = useState('');
  const [treeAgentsRaw, setTreeAgentsRaw] = useState('');
  const [millPlantSkillsExtra, setMillPlantSkillsExtra] = useState('');
  const [millPlantAgentsRaw, setMillPlantAgentsRaw] = useState(
    DEFAULT_MILL_AGENTS.join(', '),
  );
  const [facetAgentsCard, setFacetAgentsCard] = useState(false);
  const [featuresRaw, setFeaturesRaw] = useState(prettyJson(DEFAULT_FEATURES));
  const [configRaw, setConfigRaw] = useState(prettyJson(DEFAULT_CONFIG));
  const [codexRaw, setCodexRaw] = useState('');

  const [pack, setPack] = useState(DEFAULT_PACK);
  const [holder, setHolder] = useState('');
  const [did, setDid] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [mintSignature, setMintSignature] = useState('');
  const [hat, setHat] = useState<Hat | ''>('mill-cap');
  const [colorway, setColorway] = useState<Colorway | ''>('mill-cyan');
  const [dynamoCitation, setDynamoCitation] = useState('');
  const [levelRaw, setLevelRaw] = useState('');
  const [fullBox7DRaw, setFullBox7DRaw] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<MintPayload | null>(null);

  const featuresParsed = parseObjectJson(featuresRaw, 'features.json');
  const configParsed = parseObjectJson(configRaw, 'config.json');
  const codexParsed = parseObjectJson(codexRaw, 'codex.json');

  const inventory = useMemo(
    () => {
      const features = parseObjectJson(featuresRaw, 'features.json');
      const config = parseObjectJson(configRaw, 'config.json');
      const codex = parseObjectJson(codexRaw, 'codex.json');
      return buildFoundryInventory({
        consumerName,
        consumerVersion,
        millName,
        millVersion,
        suit,
        costume,
        params: {
          codex: codexPath,
          features: featuresPath,
          config: configPath,
          skills: skillsPath,
          agents: agentsPath,
          agentsCard: agentsCardPath,
        },
        treeSkillsRaw,
        treeAgentsRaw,
        millPlantSkillsExtra,
        millPlantAgentsRaw,
        constitution: Boolean(codex.ok && codex.value),
        features: Boolean(features.ok && features.value),
        config: Boolean(config.ok && config.value),
        agentsCard: facetAgentsCard,
      });
    },
    [
      consumerName,
      consumerVersion,
      millName,
      millVersion,
      suit,
      costume,
      codexPath,
      featuresPath,
      configPath,
      skillsPath,
      agentsPath,
      agentsCardPath,
      treeSkillsRaw,
      treeAgentsRaw,
      millPlantSkillsExtra,
      millPlantAgentsRaw,
      facetAgentsCard,
      featuresRaw,
      configRaw,
      codexRaw,
    ],
  );

  const inspect = receiptInspect(inventory);
  const jsonGate =
    (featuresParsed.ok ? null : featuresParsed.detail) ||
    (configParsed.ok ? null : configParsed.detail) ||
    (codexParsed.ok ? null : codexParsed.detail);
  const packId = pack.trim() || DEFAULT_PACK;
  const needsMillInspect = packId === DEFAULT_PACK;
  const previewDid = did.trim() || PREVIEW_DID;
  const explicitVariant =
    hat && colorway ? variantFromTraits(hat, colorway) : undefined;
  const previewVariant = explicitVariant ?? 0;
  const previewLevel = levelRaw === '' ? undefined : Number(levelRaw);

  const previewSvg = useMemo(
    () =>
      composeIdentitySvg({
        tokenId: minted?.tokenId || '0',
        did: previewDid,
        pack: packId,
        variant: previewVariant,
        dna: inventory.dna || '',
        level: Number.isInteger(previewLevel) ? previewLevel : undefined,
      }),
    [inventory.dna, minted?.tokenId, packId, previewDid, previewLevel, previewVariant],
  );

  const factoryConfig: FactoryConfig = {
    inventory,
    features: featuresParsed.ok ? featuresParsed.value : null,
    config: configParsed.ok ? configParsed.value : null,
    codex: codexParsed.ok ? codexParsed.value : null,
  };

  const sampleFactoryConfig = useMemo(
    () =>
      buildFoundryInventory({
        consumerName: 'demo-suit',
        consumerVersion: '0.1.0',
        millName: '@0xray/foundry',
        millVersion: '0.1.9',
        suit: 'fastened',
        costume: false,
        params: {...DEFAULT_MILL_PARAMS},
        treeSkillsRaw: '',
        treeAgentsRaw: '',
        millPlantSkillsExtra: '',
        millPlantAgentsRaw: 'mill.yml, inspect.yml',
        constitution: false,
        features: true,
        config: true,
        agentsCard: true,
      }),
    [],
  );

  const mintedImage =
    minted?.tokenId && minted.dryRun !== true
      ? `${IMAGE_BASE}${minted.tokenId}`
      : null;

  const canMint =
    holder.trim().length > 0 &&
    did.trim().length > 0 &&
    apiKey.trim().length > 0 &&
    mintSignature.trim().length > 0 &&
    !jsonGate &&
    (!needsMillInspect || inspect.ok);

  async function onMint(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const args: Record<string, unknown> = {
        did: did.trim(),
        apiKey: apiKey.trim(),
        pack: packId,
        to: holder.trim(),
        issuedAtMs: Date.now(),
        mintSignature: mintSignature.trim(),
      };
      if (needsMillInspect) {
        args.inventory = inventory;
        args.inspect = {ok: true, dna: inventory.dna};
      }
      if (explicitVariant !== undefined) args.variant = explicitVariant;
      if (dynamoCitation.trim()) args.dynamoCitation = dynamoCitation.trim();
      if (levelRaw !== '') args.level = Number(levelRaw);
      if (fullBox7DRaw !== '') args.fullBox7D = Number(fullBox7DRaw);
      const result = await callMintSuit(args);
      setMinted(result);
    } catch (err) {
      setMinted(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Layout
      title="Hangar"
      description="x402 shops on Base. npx groover-hangar. Fund local OWS with USDC. Mint is a name."
    >
      <main className={styles.bay}>
        <header className={styles.hud}>
          <div className={styles.cores}>
            <span className={styles.core}>MILL</span>
            <span className={styles.wordmark}>HANGAR</span>
            <span className={styles.core}>SHOPS</span>
          </div>
          <Heading as="h1">Pay a shop. Or become one.</Heading>
          <p>
            No Groover login. Mill and DID are optional. To pay: local{' '}
            <a href="https://docs.openwallet.sh">OWS</a> wallet, funded with{' '}
            <strong>USDC on Base</strong> from another wallet or exchange (not
            Ethereum). Hosted <code>/sign</code> is 410.
          </p>
          <pre className={styles.code}>{`npx groover-hangar
curl -fsSL https://docs.openwallet.sh/install.sh | bash
ows wallet create --name agent-treasury-1
# send USDC on Base to the eip155:8453 address
ows pay request 'https://clearing-production-9968.up.railway.app/v1/extract?url=https://example.com' --wallet agent-treasury-1`}</pre>
          <p>
            Grok bot is Grok CLI on that same machine — not grok.com. Install{' '}
            <code>grok plugin marketplace add htafolla/groover</code> then{' '}
            <code>grok plugin install shop-extract --trust</code>. New session. Ask
            it to extract a URL; it 402s then runs <code>ows pay request</code>.
            Skills are not a wallet. Node 20. Project root, never passwd-home{' '}
            <code>~</code>.
          </p>
          <div className={styles.prefabs}>
            <a className={styles.prefab} href="/mill-plant.tgz">
              mill
              <span>mill + inspect. Free. Not the 45-skill costume.</span>
            </a>
            <a
              className={styles.prefab}
              href="https://clearing-production-9968.up.railway.app/v1/extract?url=https://example.com"
            >
              shop-extract
              <span>$0.02 · unpaid GET → 402 · receipted URL</span>
            </a>
            <a
              className={styles.prefab}
              href="https://clearing-production-9968.up.railway.app/v1/witness?url=https://example.com"
            >
              shop-witness
              <span>$0.02 · unpaid GET → 402 · proof of a GET</span>
            </a>
            <a
              className={styles.prefab}
              href="https://clearing-production-9968.up.railway.app/v1/pin?agentId=86025"
            >
              shop-pin
              <span>$0.01 · unpaid GET → 402 · ERC-8004 card</span>
            </a>
          </div>
        </header>

        <div className={styles.grid}>
          <form
            className={styles.panel}
            onSubmit={(event) => {
              event.preventDefault();
              void onMint();
            }}
          >
            <fieldset className={styles.block}>
              <legend>01 · Mill plant (optional)</legend>
              <p className={styles.fieldHint}>
                Not required to pay a shop. Fastens mill+inspect into the
                project. Load a sample if you want a suit, not a 402.
              </p>
              <div className={styles.sampleBar}>
                <button
                  type="button"
                  className={styles.sampleBtn}
                  onClick={() => {
                    setConsumerName('demo-suit');
                    setConsumerVersion('0.1.0');
                    setMillName('@0xray/foundry');
                    setMillVersion('0.1.9');
                    setSuit('fastened');
                    setCostume(false);
                    setMillPlantSkillsExtra('');
                    setMillPlantAgentsRaw('mill.yml, inspect.yml');
                    setTreeSkillsRaw('');
                    setTreeAgentsRaw('');
                    setFacetAgentsCard(true);
                  }}
                >
                  Load sample factory
                </button>
              </div>
              <div className={styles.row2}>
                <label>
                  App name
                  <span className={styles.fieldHint}>Your project. Ends up in the inventory.</span>
                  <input
                    value={consumerName}
                    onChange={(e) => setConsumerName(e.target.value)}
                    placeholder="acme-app"
                    required
                  />
                </label>
                <label>
                  App version
                  <input
                    value={consumerVersion}
                    onChange={(e) => setConsumerVersion(e.target.value)}
                    placeholder="1.0.0"
                    required
                  />
                </label>
                <label>
                  Mill
                  <span className={styles.fieldHint}>The builder stamping this suit. Leave as-is.</span>
                  <input value={millName} onChange={(e) => setMillName(e.target.value)} />
                </label>
                <label>
                  Mill version
                  <input
                    value={millVersion}
                    onChange={(e) => setMillVersion(e.target.value)}
                  />
                </label>
                <label>
                  Suit fit
                  <span className={styles.fieldHint}>{SUIT_FIT_HELP[suit]}</span>
                  <select
                    value={suit}
                    onChange={(e) => setSuit(e.target.value as SuitKind)}
                  >
                    <option value="fastened">fastened</option>
                    <option value="overlay">overlay</option>
                    <option value="costume">costume</option>
                  </select>
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={suit === 'costume' || costume}
                    onChange={(e) => setCostume(e.target.checked)}
                  />
                  Full costume copy (45 skills / 42 agents)
                </label>
              </div>
              <ChipInput
                label="Extra skills"
                hint="mill + inspect are always planted. Add yours below."
                value={millPlantSkillsExtra}
                onChange={setMillPlantSkillsExtra}
                locked={['mill', 'inspect']}
                samples={SAMPLE_SKILLS}
              />
              <ChipInput
                label="Extra agents"
                hint="mill.yml + inspect.yml always planted. Use .yml names."
                value={millPlantAgentsRaw}
                onChange={setMillPlantAgentsRaw}
                locked={['mill.yml', 'inspect.yml']}
                samples={SAMPLE_AGENTS}
              />
              <div className={styles.row2}>
                <ChipInput
                  label="Skills already in your repo"
                  hint="We leave these alone unless you overlay them."
                  value={treeSkillsRaw}
                  onChange={setTreeSkillsRaw}
                  samples={SAMPLE_TREE_SKILLS}
                />
                <ChipInput
                  label="Agents already in your repo"
                  value={treeAgentsRaw}
                  onChange={setTreeAgentsRaw}
                  samples={SAMPLE_TREE_AGENTS}
                />
              </div>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={facetAgentsCard}
                  onChange={(e) => setFacetAgentsCard(e.target.checked)}
                />
                Starter AGENTS.md card
                <span className={styles.fieldHint}>Drops our starter card on top of yours.</span>
              </label>
              <details>
                <summary>Advanced: install paths</summary>
                <label>
                  features
                  <input
                    value={featuresPath}
                    onChange={(e) => setFeaturesPath(e.target.value)}
                  />
                </label>
                <label>
                  config
                  <input
                    value={configPath}
                    onChange={(e) => setConfigPath(e.target.value)}
                  />
                </label>
                <label>
                  codex
                  <input
                    value={codexPath}
                    onChange={(e) => setCodexPath(e.target.value)}
                  />
                </label>
                <label>
                  skills
                  <input
                    value={skillsPath}
                    onChange={(e) => setSkillsPath(e.target.value)}
                  />
                </label>
                <label>
                  agents
                  <input
                    value={agentsPath}
                    onChange={(e) => setAgentsPath(e.target.value)}
                  />
                </label>
                <label>
                  agentsCard
                  <input
                    value={agentsCardPath}
                    onChange={(e) => setAgentsCardPath(e.target.value)}
                  />
                </label>
              </details>
            </fieldset>

            <fieldset className={styles.block}>
              <legend>02 · Mill switches (optional)</legend>
              <p className={styles.hint}>
                These go in the download. <code>install.mjs</code> writes plant path +{' '}
                <code>.xray/</code>. Mill-safe defaults — not the 45/42 costume.
              </p>
              <label>
                features.json
                <span className={styles.fieldHint}>Behavior switches for the mill.</span>
                <textarea
                  className={styles.json}
                  value={featuresRaw}
                  onChange={(e) => setFeaturesRaw(e.target.value)}
                  spellCheck={false}
                  rows={14}
                />
              </label>
              <label>
                config.json
                <span className={styles.fieldHint}>Limits and keys.</span>
                <textarea
                  className={styles.json}
                  value={configRaw}
                  onChange={(e) => setConfigRaw(e.target.value)}
                  spellCheck={false}
                  rows={10}
                />
              </label>
              <label>
                codex.json (optional)
                <span className={styles.fieldHint}>House rules for the mill. Empty is fine.</span>
                <textarea
                  className={styles.json}
                  value={codexRaw}
                  onChange={(e) => setCodexRaw(e.target.value)}
                  spellCheck={false}
                  rows={6}
                  placeholder="{ }  — paste mill constitution or leave empty"
                />
              </label>
              <p className={inspect.ok && !jsonGate ? styles.ok : styles.bad}>
                {jsonGate ||
                  (inspect.ok
                    ? `RECEIPT PASS · ${inventory.dna}`
                    : inspect.detail)}
              </p>
            </fieldset>

            <fieldset className={styles.block}>
              <legend>03 · mint (optional name)</legend>
              <p className={styles.fieldHint}>
                Not required to pay. Needs a registered Groover DID, API key,
                and Ed25519 mintSignature. Tourists cannot click MINT empty.
              </p>
              <div className={styles.row2}>
                <label>
                  Pack
                  <span className={styles.fieldHint}>Leave 0xray-suit.</span>
                  <input
                    value={pack}
                    onChange={(e) => setPack(e.target.value)}
                    placeholder={DEFAULT_PACK}
                  />
                </label>
                <label>
                  Holder wallet
                  <span className={styles.fieldHint}>Receives the token.</span>
                  <input
                    value={holder}
                    onChange={(e) => setHolder(e.target.value)}
                    placeholder="0x…"
                  />
                </label>
                <label>
                  DID
                  <span className={styles.fieldHint}>did:groover: + 16 hex chars.</span>
                  <input
                    value={did}
                    onChange={(e) => setDid(e.target.value)}
                    placeholder="did:groover:…"
                  />
                </label>
                <label>
                  Groover API key
                  <span className={styles.fieldHint}>Never shared. Only sent to mint.</span>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label>
                  mintSignature
                  <input
                    value={mintSignature}
                    onChange={(e) => setMintSignature(e.target.value)}
                    placeholder="Ed25519 over groover-mint:v1|did|pack|to|issuedAtMs"
                    autoComplete="off"
                  />
                </label>
                <label>
                  Visor look
                  <span className={styles.fieldHint}>Empty = picked from DNA.</span>
                  <select
                    value={hat}
                    onChange={(e) => setHat(e.target.value as Hat | '')}
                  >
                    <option value="">from DNA</option>
                    {HATS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Color look
                  <span className={styles.fieldHint}>Empty = picked from DNA.</span>
                  <select
                    value={colorway}
                    onChange={(e) => setColorway(e.target.value as Colorway | '')}
                  >
                    <option value="">from DNA</option>
                    {COLORWAYS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Dynamo citation
                <input
                  value={dynamoCitation}
                  onChange={(e) => setDynamoCitation(e.target.value)}
                  placeholder="empty → Unknown"
                />
              </label>
              <div className={styles.row2}>
                <label>
                  Level 0–4
                  <input
                    value={levelRaw}
                    onChange={(e) => setLevelRaw(e.target.value)}
                    placeholder="empty → Unknown"
                  />
                </label>
                <label>
                  fullBox7D
                  <input
                    value={fullBox7DRaw}
                    onChange={(e) => setFullBox7DRaw(e.target.value)}
                  />
                </label>
              </div>
              <button type="submit" className={styles.fire} disabled={!canMint || busy}>
                {busy ? 'MINTING…' : 'MINT 0xRAY-SUIT'}
              </button>
              {error ? <p className={styles.bad}>{error}</p> : null}
            </fieldset>
          </form>

          <aside className={styles.side}>
            <div className={styles.preview}>
              <div className={styles.previewFrame}>
                {mintedImage ? (
                  <img src={mintedImage} alt={`GRVR token ${minted?.tokenId}`} />
                ) : (
                  <div
                    className={styles.svg}
                    dangerouslySetInnerHTML={{__html: previewSvg}}
                  />
                )}
              </div>
              {mintedImage ? (
                <p className={styles.ok}>LIVE TOKEN · #{minted?.tokenId}</p>
              ) : (
                <p className={styles.hint}>Hangar preview. After mint this is token-image.</p>
              )}
              {minted?.tokenId ? (
                <p className={styles.links}>
                  {minted.txHash ? (
                    <a
                      href={`https://basescan.org/tx/${minted.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Basescan
                    </a>
                  ) : null}
                  <a
                    href={`https://opensea.io/item/base/${GRVR_V4}/${minted.tokenId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    OpenSea
                  </a>
                  <a href={mintedImage || `${IMAGE_BASE}${minted.tokenId}`}>token-image</a>
                  {minted.dryRun ? <span>dry-run</span> : null}
                </p>
              ) : null}
            </div>

            <section className={styles.panel}>
              <h2>04 · mill tarball</h2>
              <p className={styles.hint}>
                Shops are <code>npx groover-hangar</code> (or Grok plugin). This
                tarball is mill+inspect only. Run from the project root — not{' '}
                <code>~/.grok</code>.
              </p>
              <div className={styles.downloads}>
                <a className={styles.dl} href="/mill-plant.tgz" download>
                  mill-plant.tgz
                </a>
                <button
                  type="button"
                  className={styles.dl}
                  onClick={() => downloadJson('factory-config.json', factoryConfig)}
                >
                  factory-config.json
                </button>
                <button
                  type="button"
                  className={styles.dl}
                  title="Pre-filled demo — try the flow without typing"
                  onClick={() => downloadJson('sample-factory-config.json', sampleFactoryConfig)}
                >
                  sample-factory-config.json
                </button>
              </div>
              <ol className={styles.drop}>
                <li>
                  Unpack <code>mill-plant.tgz</code> in the project
                </li>
                <li>
                  Drop <code>factory-config.json</code> on the repo root (inventory +
                  features + config + optional constitution)
                </li>
                <li>
                  <code>node mill-plant/install.mjs</code> — plants mill+inspect, writes{' '}
                  <code>.xray/</code> + plant JSON, <code>npm i -D 0xray@4.0.9</code>
                </li>
                <li>
                  <code>npx @0xray/foundry mint</code> then{' '}
                  <code>npx @0xray/foundry inspect</code>
                  {' '}(or <code>node mill-plant/install.mjs --mint</code>)
                </li>
              </ol>
              <pre className={styles.code}>{CLI_LOAD}</pre>
            </section>
          </aside>
        </div>
      </main>
    </Layout>
  );
}
