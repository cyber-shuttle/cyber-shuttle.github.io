import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const repo = (name: string) => `https://github.com/cyber-shuttle/${name}`;

const config: Config = {
  title: 'Cybershuttle Docs',
  favicon: 'img/logo.png',
  future: {v4: true},
  url: 'https://cyber-shuttle.github.io',
  baseUrl: '/',
  organizationName: 'cyber-shuttle',
  projectName: 'cyber-shuttle.github.io',
  markdown: {mermaid: true, hooks: {onBrokenMarkdownLinks: 'throw'}},
  themes: ['@docusaurus/theme-mermaid', './theme'],
  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: `${repo('cyber-shuttle.github.io')}/tree/main/`,
          beforeDefaultRemarkPlugins: [require('./theme/remark')],
        },
        blog: false,
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    docs: {sidebar: {hideable: true}},
    navbar: {
      title: 'Cybershuttle',
      logo: {alt: 'Cybershuttle', src: 'img/logo.png'},
      items: [
        {type: 'docSidebar', sidebarId: 'vscode', label: 'VS Code', position: 'left', className: 'nav--researcher'},
        {type: 'docSidebar', sidebarId: 'jupyter', label: 'Jupyter', position: 'left', className: 'nav--researcher'},
        {type: 'docSidebar', sidebarId: 'batch', label: 'Batch', position: 'left', className: 'nav--researcher'},
        {type: 'docSidebar', sidebarId: 'planning', label: 'Planning', position: 'left', className: 'nav--provider'},
        {type: 'docSidebar', sidebarId: 'settingUp', label: 'Setting up', position: 'left', className: 'nav--provider'},
        {type: 'docSidebar', sidebarId: 'operating', label: 'Operating', position: 'left', className: 'nav--provider'},
        {type: 'custom-audience', position: 'right'},
        {
          href: 'https://github.com/cyber-shuttle',
          position: 'right',
          className: 'nav--github',
          'aria-label': 'GitHub',
          html: '<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" style="vertical-align:-3px"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {label: 'CS Jupyter', href: repo('cs-jupyter')},
        {label: 'CS Bridge', href: repo('CS-Bridge')},
        {label: 'Linkspan', href: repo('linkspan')},
        {label: 'Apache Airavata', href: 'https://github.com/apache/airavata'},
        {label: 'Airavata Custos', href: 'https://github.com/apache/airavata-custos'},
      ],
      copyright: `Supported by the U.S. National Science Foundation under awards 2209872, 2209873, 2209874 and 2209875.<br/>Copyright © ${new Date().getFullYear()} <a href="https://gt-artisan.github.io/">ARTISAN Research Group</a>, Georgia Institute of Technology.<br/>Licensed under the Apache License 2.0.`,
    },
    mermaid: {theme: {light: 'base', dark: 'base'}, options: {themeVariables: {fontFamily: 'Roboto Serif, Georgia, serif'}}},
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
