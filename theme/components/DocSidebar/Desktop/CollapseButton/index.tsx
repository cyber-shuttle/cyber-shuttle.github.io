import type {Props} from '@theme/DocSidebar/Desktop/CollapseButton';
import {PanelButton} from '../../../../lib/controls';

export default function CollapseButton({onClick}: Props) {
  return <PanelButton panel="pages" onClick={onClick} />;
}
