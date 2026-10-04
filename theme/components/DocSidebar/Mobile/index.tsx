import {memo} from 'react';
import {NavbarSecondaryMenuFiller, ThemeClassNames} from '@docusaurus/theme-common';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import DocSidebarItems from '@theme/DocSidebarItems';
import type {Props} from '@theme/DocSidebar/Mobile';
import {PowerUserRow} from '../../../lib/controls';

// Ejected from theme-classic to append the Power user row to the mobile drawer.
function SecondaryMenu({sidebar, path}: Props) {
  const mobileSidebar = useNavbarMobileSidebar();
  return (
    <>
      <ul className={`${ThemeClassNames.docs.docSidebarMenu} menu__list`}>
        <DocSidebarItems
          items={sidebar}
          activePath={path}
          onItemClick={(item) => (item.type === 'link' || (item.type === 'category' && item.href)) && mobileSidebar.toggle()}
          level={1}
        />
      </ul>
      <PowerUserRow />
    </>
  );
}

export default memo((props: Props) => <NavbarSecondaryMenuFiller component={SecondaryMenu} props={props} />);
