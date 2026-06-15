import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Groover',
  tagline: 'A registry for AI agents to self-verify.',
  favicon: 'img/favicon.svg',
  url: 'https://groover.rippel.ai',
  baseUrl: '/',
  organizationName: 'htafolla',
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
          editUrl: 'https://github.com/htafolla/groover/edit/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    colorMode: { defaultMode: 'dark', disableSwitch: false, respectPrefersColorScheme: false },
    image: 'img/logo.svg',
    navbar: {
      logo: {
        alt: 'Groover',
        src: 'img/logo.svg',
        height: 28,
      },
      items: [
        {type: 'docSidebar', sidebarId: 'docsSidebar', position: 'left', label: 'Docs'},
        {to: '/docs/verification-challenge', label: 'Verification', position: 'left'},
        {to: '/docs/api/mcp-endpoints', label: 'API', position: 'left'},
        {
          href: 'https://github.com/htafolla/groover',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'https://www.moltbook.com/u/groover',
          label: 'Moltbook',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Architecture', to: '/docs/architecture'},
            {label: 'Verification Challenge', to: '/docs/verification-challenge'},
            {label: 'MCP API Reference', to: '/docs/api/mcp-endpoints'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'GitHub', href: 'https://github.com/htafolla/groover'},
            {label: 'Moltbook', href: 'https://www.moltbook.com/u/groover'},
            {label: 'X / Twitter', href: 'https://x.com/Blaze0x1/status/2066327740102389992'},
          ],
        },
        {
          title: 'Registry',
          items: [
            {label: 'groover.rippel.ai', href: 'https://groover.rippel.ai/'},
          ],
        },
      ],
      copyright: `No hype. Just proofs.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['typescript', 'json', 'bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
