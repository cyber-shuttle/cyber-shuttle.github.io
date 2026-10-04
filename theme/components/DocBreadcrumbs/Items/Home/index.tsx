import Link from '@docusaurus/Link';
import {useThemeConfig} from '@docusaurus/theme-common';
import {useDocById, useDocsSidebar} from '@docusaurus/plugin-content-docs/client';
import type {PropSidebarItemLink} from '@docusaurus/plugin-content-docs';
import IconHome from '@theme/Icon/Home';

// The breadcrumb home is the current tab's first page, named after the tab: its navbar label, or the title of its
// first page for a sidebar without a navbar tab of its own. The navbar logo remains the site home.
export default function TabHome() {
  const sidebar = useDocsSidebar()!;
  const first = sidebar.items[0] as PropSidebarItemLink;
  const title = useDocById(first.docId)?.title;
  const label = (useThemeConfig().navbar.items as {sidebarId?: string; label?: string}[]).find((item) => item.sidebarId === sidebar.name)?.label ?? title;
  return (
    <li className="breadcrumbs__item">
      <Link className="breadcrumbs__link tab-home" href={first.href} aria-label={`${label} home`}>
        <IconHome className="tab-home__icon" />
        {label}
      </Link>
    </li>
  );
}
