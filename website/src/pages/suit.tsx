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

const CLI_LOAD = `unzip mill-plant.zip
# factory-config.json from this page → repo root
node mill-plant/install.mjs --from factory-config.json
npx @0xray/foundry mint
npx @0xray/foundry inspect`;

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

  const mintedImage =
    minted?.tokenId && minted.dryRun !== true
      ? `${IMAGE_BASE}${minted.tokenId}`
      : null;

  const canMint =
    holder.trim().length > 0 &&
    did.trim().length > 0 &&
    apiKey.trim().length > 0 &&
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
      title="0xray factory"
      description="0xray mill configurator — set mill params and features.json, download mill+inspect, load it in the CLI, mint the suit."
    >
      <main className={styles.bay}>
        <header className={styles.hud}>
          <div className={styles.cores}>
            <span className={styles.core}>MILL</span>
            <span className={styles.wordmark}>0xRAY FACTORY</span>
            <span className={styles.core}>INSPECT</span>
          </div>
          <Heading as="h1">Build your mill. Fasten the suit. Load the CLI.</Heading>
          <p>
            This is the 0xray configurator. Set mill params, <code>features.json</code>,
            and the other mill config. Download mill+inspect. Run the install script.
            Mint <code>0xray-suit</code> and see the token.
          </p>
          <p>
            Prefab agents are <strong>free to start</strong> — download, load the skill, dry-run.
            Mint later if you want a Groover name. They operate in Groover + Clearing + ZigZag:
            local keys, independent caps, hosted 402 shops.
          </p>
          <div className={styles.prefabs}>
            <a className={styles.prefab} href="/mill-plant.tgz">
              lean mill-plant.tgz
              <span>mill + inspect only. Free. Not the 45-skill costume. npm i -D 0xray@4.0.9</span>
            </a>
            <a className={styles.prefab} href="/prefabs/lean/README.md">
              lean clerk
              <span>
                Pay for proof of a GET: extract + witness ($0.02). Idempotent paymentId. Not a coworker.
              </span>
            </a>
            <a className={styles.prefab} href="/prefabs/8004-pin/README.md">
              8004-pin
              <span>Optional. Pin a live ERC-8004 card. Not required to use extract/witness.</span>
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
              <legend>01 · mill params</legend>
              <div className={styles.row2}>
                <label>
                  Consumer name
                  <input
                    value={consumerName}
                    onChange={(e) => setConsumerName(e.target.value)}
                    placeholder="acme-app"
                    required
                  />
                </label>
                <label>
                  Consumer version
                  <input
                    value={consumerVersion}
                    onChange={(e) => setConsumerVersion(e.target.value)}
                    placeholder="1.0.0"
                    required
                  />
                </label>
                <label>
                  Mill name
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
                  Suit
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
                  costume dump
                </label>
              </div>
              <label>
                Extra mill-plant skills
                <input
                  value={millPlantSkillsExtra}
                  onChange={(e) => setMillPlantSkillsExtra(e.target.value)}
                  placeholder="mill + inspect locked"
                />
              </label>
              <label>
                Mill-plant agents
                <input
                  value={millPlantAgentsRaw}
                  onChange={(e) => setMillPlantAgentsRaw(e.target.value)}
                />
              </label>
              <div className={styles.row2}>
                <label>
                  Tree skills
                  <input
                    value={treeSkillsRaw}
                    onChange={(e) => setTreeSkillsRaw(e.target.value)}
                    placeholder="overlay names"
                  />
                </label>
                <label>
                  Tree agents
                  <input
                    value={treeAgentsRaw}
                    onChange={(e) => setTreeAgentsRaw(e.target.value)}
                    placeholder="optional.yml"
                  />
                </label>
              </div>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={facetAgentsCard}
                  onChange={(e) => setFacetAgentsCard(e.target.checked)}
                />
                overlay AGENTS.md card
              </label>
              <details>
                <summary>plant paths</summary>
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
              <legend>02 · features.json · config · constitution</legend>
              <p className={styles.hint}>
                These go in the download. <code>install.mjs</code> writes plant path +{' '}
                <code>.xray/</code>. Mill-safe defaults — not the 45/42 costume.
              </p>
              <label>
                features.json
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
                <textarea
                  className={styles.json}
                  value={configRaw}
                  onChange={(e) => setConfigRaw(e.target.value)}
                  spellCheck={false}
                  rows={10}
                />
              </label>
              <label>
                codex.json (optional mill constitution)
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
              <legend>03 · mint</legend>
              <div className={styles.row2}>
                <label>
                  Pack
                  <input
                    value={pack}
                    onChange={(e) => setPack(e.target.value)}
                    placeholder={DEFAULT_PACK}
                  />
                </label>
                <label>
                  Holder
                  <input
                    value={holder}
                    onChange={(e) => setHolder(e.target.value)}
                    placeholder="0x…"
                  />
                </label>
                <label>
                  DID
                  <input
                    value={did}
                    onChange={(e) => setDid(e.target.value)}
                    placeholder="did:groover:…"
                  />
                </label>
                <label>
                  apiKey
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoComplete="off"
                  />
                </label>
                <label>
                  Visor
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
                  Colorway
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
              <h2>04 · download · load CLI</h2>
              <p className={styles.hint}>
                Zip is mill+inspect + <code>install.mjs</code>. Config JSON is your
                factory. Run the script from the repo root — not machine{' '}
                <code>~/.grok</code>.
              </p>
              <div className={styles.downloads}>
                <a className={styles.dl} href="/mill-plant.zip" download>
                  mill-plant.zip
                </a>
                <button
                  type="button"
                  className={styles.dl}
                  onClick={() => downloadJson('factory-config.json', factoryConfig)}
                >
                  factory-config.json
                </button>
              </div>
              <ol className={styles.drop}>
                <li>
                  Unzip <code>mill-plant.zip</code> in the project
                </li>
                <li>
                  Drop <code>factory-config.json</code> on the repo root (inventory +
                  features + config + optional constitution)
                </li>
                <li>
                  <code>node mill-plant/install.mjs</code> — plants mill+inspect, writes{' '}
                  <code>.xray/</code> + plant JSON, <code>npm i -D @0xray/foundry</code>
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
