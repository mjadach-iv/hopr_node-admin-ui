import { isDesktop } from '../../utils/desktop';
import ContainerUpdate from './container';
import DesktopUpdate from './desktop';

/** Header item shown when a newer release than the running one exists: desktop app or Docker container. */
export default function UpdateAvailable() {
  return isDesktop ? <DesktopUpdate /> : <ContainerUpdate />;
}
