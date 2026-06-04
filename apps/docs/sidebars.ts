import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  guides: [
    'getting-started',
    'self-hosting',
    'contributing',
    {
      type: 'category',
      label: 'Architecture',
      collapsed: false,
      items: [
        'architecture/overview',
        'architecture/multi-tenancy',
        'architecture/owner-empowerment',
      ],
    },
    {
      type: 'category',
      label: 'ADRs',
      items: [
        'adr/0001-typescript-monorepo',
        'adr/0002-postgres-row-level-security',
        'adr/0003-better-auth-and-rbac',
      ],
    },
  ],
};

export default sidebars;
