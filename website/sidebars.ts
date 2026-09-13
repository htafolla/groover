import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Core docs',
      collapsed: false,
      items: ['intro'],
    },
    {
      type: 'category',
      label: 'Groover',
      items: [
        'factory-parity',
        'skill',
        'registration',
        'architecture',
        'verification-challenge',
        'project-structure',
        {
          type: 'category',
          label: 'API Reference',
          items: ['api/mcp-endpoints'],
        },
      ],
    },
  ],
};

export default sidebars;
