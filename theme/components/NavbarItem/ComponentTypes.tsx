import ComponentTypes from '@theme-init/NavbarItem/ComponentTypes';
import {AudienceToggle} from '../../lib/controls';

// The toggle stays in the collapsed navbar, so the mobile menu gets no second copy.
export default {...ComponentTypes, 'custom-audience': ({mobile}: {mobile?: boolean}) => (mobile ? null : <AudienceToggle />)};
