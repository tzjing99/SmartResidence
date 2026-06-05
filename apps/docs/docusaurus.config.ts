import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';

const config: Config = {
  title: 'SmartResidence',
  tagline: 'Open-source condo management — built for residents, run by communities.',
  favicon: 'img/favicon.ico',
  url: 'https://docs.smartresidence.dev',
  baseUrl: '/',
  organizationName: 'tzjing99',
  projectName: 'SmartResidence',
  trailingSlash: false,
  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',
  i18n: { defaultLocale: 'en', locales: ['en', 'ms', 'zh-Hans'] },
  markdown: { mermaid: true },
  themes: ['@docusaurus/theme-mermaid', 'docusaurus-theme-openapi-docs'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/tzjing99/SmartResidence/edit/main/apps/docs/',
          docItemComponent: '@theme/ApiItem',
        },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'api',
        docsPluginId: 'classic',
        config: {
          smartresidence: {
            specPath: '../../packages/api-client/openapi/openapi.json',
            outputDir: 'docs/api/reference',
            sidebarOptions: { groupPathsBy: 'tag' },
          },
        },
      },
    ],
  ],

  themeConfig: {
    image: 'img/social.png',
    colorMode: { defaultMode: 'light', respectPrefersColorScheme: true },
    navbar: {
      title: 'SmartResidence',
      items: [
        { type: 'docSidebar', sidebarId: 'guides', position: 'left', label: 'Guides' },
        { to: '/docs/architecture/overview', position: 'left', label: 'Architecture' },
        { to: '/docs/api/reference', position: 'left', label: 'API' },
        {
          href: 'https://github.com/tzjing99/SmartResidence',
          label: 'GitHub',
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
            { label: 'Getting started', to: '/docs/getting-started' },
            { label: 'Self-hosting', to: '/docs/self-hosting' },
            { label: 'Architecture', to: '/docs/architecture/overview' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'Contributing', to: '/docs/contributing' },
            {
              label: 'GitHub Discussions',
              href: 'https://github.com/tzjing99/SmartResidence/discussions',
            },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} SmartResidence contributors. AGPL-3.0-or-later.`,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
