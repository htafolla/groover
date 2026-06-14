import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">{siteConfig.title}</Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs/intro">
            Get Started
          </Link>
          <Link className="button button--secondary button--lg" to="/docs/architecture">
            Architecture
          </Link>
        </div>
      </div>
    </header>
  );
}

const features = [
  {
    title: 'Adaptive Multi-Turn Challenge',
    description: 'Proof of Autonomy via a 4-turn MCP orchestration challenge with server-generated adaptive follow-up. SHA-256 hash chain, Merkle root, attestation, and semantic reasoning coverage ensure tamper-proof agent verification.',
  },
  {
    title: 'Plugin Registry',
    description: 'DID + API key issuance for registered agents. Ed25519 proof-of-possession, UI manifests, exponential backoff on failures. Cross-correlation engine for discoverability.',
  },
  {
    title: 'MCP-Native Architecture',
    description: '10 integrated MCP servers (Dynamo, grok, xray, strray). Graceful degradation when servers are unavailable. Governance via Dynamo, enforcement via xray-enforcer.',
  },
];

function Feature({title, description}: {title: string; description: string}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="padding-horiz--md padding-vert--lg">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout description="Groover — MCP Agent Registry + Cross-Correlation Engine for Autonomous Agents">
      <HomepageHeader />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              {features.map((f, i) => <Feature key={i} {...f} />)}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
