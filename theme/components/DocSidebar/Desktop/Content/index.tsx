import Content from '@theme-init/DocSidebar/Desktop/Content';
import type {Props} from '@theme/DocSidebar/Desktop/Content';
import {PowerUserRow} from '../../../../lib/controls';

// The sidebar is a flex column with the menu growing, so the Power user row stays at its bottom.
export default function ContentWithPowerUser(props: Props) {
  return (
    <>
      <Content {...props} />
      <PowerUserRow />
    </>
  );
}
