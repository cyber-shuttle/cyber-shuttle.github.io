import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// Every tab is a flat list of pages. Pages in `advanced` are detailed material the theme shows to researchers only
// with the Power user switch on, and always to providers.
const tab = (dir: string, pages: string[], advanced: string[] = []) => [
  ...pages.map((page) => `${dir}/${page}`),
  ...advanced.map((page) => ({type: 'doc' as const, id: `${dir}/${page}`, className: 'sidebar--advanced'})),
];

const sidebars: SidebarsConfig = {
  overview: tab('overview', ['index', 'how-it-works', 'architecture', 'roadmap', 'glossary', 'project-and-funding']),
  vscode: tab(
    'vscode',
    ['index', 'getting-started', 'sessions-and-runs', 'troubleshooting'],
    ['user-interface', 'error-messages', 'architecture', 'development'],
  ),
  jupyter: tab(
    'jupyter',
    ['index', 'getting-started', 'sessions-and-runs', 'environment-and-kernels', 'troubleshooting'],
    ['user-interface', 'architecture', 'security', 'development'],
  ),
  batch: tab(
    'batch',
    ['index', 'cs-batch', 'checkpoint-restore', 'nextflow-pipelines'],
    ['running-linkspan-by-hand', 'linkspan-architecture', 'linkspan-configuration', 'linkspan-http-api', 'linkspan-workflow-format', 'linkspan-development'],
  ),
  planning: tab('planning', ['index', 'requirements', 'cluster-security', 'security-model', 'managing-allocations']),
  settingUp: tab('setting-up', [
    'preparing-the-cluster',
    'hosting-airavata',
    'hosting-the-jupyter-site',
    'connecting-custos',
    'airavata-configuration',
    'airavata-architecture',
    'airavata-development',
  ]),
  operating: tab('operating', [
    'visibility-and-control',
    'running-in-production',
    'running-custos',
    'troubleshooting',
    'compatibility',
    'airavata-sessions-and-runs',
    'airavata-ssh-hosts-and-keys',
    'airavata-persistence',
    'airavata-http-api',
  ]),
};

export default sidebars;
