import type {Props} from '@theme/DocRoot/Layout/Sidebar/ExpandButton';
import {useSidebarBreadcrumbs} from '@docusaurus/plugin-content-docs/client';
import {PanelButton} from '../../../../../lib/controls';

export default function ExpandButton({toggleSidebar}: Props) {
  return <PanelButton panel="pages" collapsed detail={useSidebarBreadcrumbs()?.at(-1)?.label} onClick={toggleSidebar} />;
}
