import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'architecture',
    'verification-challenge',
    'project-structure',
    {
      type: 'category',
      label: 'API Reference',
      items: ['api/mcp-endpoints'],
    },
  ],
};

export default sidebars;
