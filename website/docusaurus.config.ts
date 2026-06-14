import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Groover',
  tagline: 'MCP Agent Registry + Cross-Correlation Engine for Autonomous Agents',
  favicon: 'img/favicon.ico',
  url: 'https://groover.dev',
  baseUrl: '/',
  organizationName: 'anomalyco',
  projectName: 'groover',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/anomalyco/groover/edit/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    image: 'img/groover-social-card.jpg',
    navbar: {
      title: 'Groover',
      items: [
        {type: 'docSidebar', sidebarId: 'docsSidebar', position: 'left', label: 'Docs'},
        {href: 'https://github.com/anomalyco/groover', label: 'GitHub', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Getting Started', to: '/docs/intro'},
            {label: 'Architecture', to: '/docs/architecture'},
            {label: 'Verification Challenge', to: '/docs/verification-challenge'},
            {label: 'MCP API Reference', to: '/docs/api/mcp-endpoints'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'GitHub', href: 'https://github.com/anomalyco/groover'},
          ],
        },
      ],
      copyright: `Built under His authority. All actions governed.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['typescript', 'json', 'bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
