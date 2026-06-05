import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  guides: [
    'getting-started',
    'features/visitors',
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
        'adr/typescript-monorepo',
        'adr/postgres-row-level-security',
        'adr/better-auth-and-rbac',
      ],
    },
  ],
};

export default sidebars;
