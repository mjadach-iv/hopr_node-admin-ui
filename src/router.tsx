import { createBrowserRouter, Navigate, RouteObject } from 'react-router-dom';
import { environment } from '../config';

import NodeLandingPage from './pages/node/landingPage';
import TermsOfService from './pages/TermsOfService';
import SafeAppAllowancePage from './pages/safe-app/allowance';

import LayoutEnhanced from './LayoutEnhanced';
import { applicationMap } from './applicationMap';
import { SAFE_APP_PATH } from './utils/safeApp';

const routes = [
  {
    path: '/',
    element: <LayoutEnhanced />,
    children: [] as RouteObject[],
  },
  // outside the layout: shown inside Safe{Wallet}, without node, menu or watcher
  {
    path: SAFE_APP_PATH,
    element: <SafeAppAllowancePage />,
    children: [] as RouteObject[],
  },
  {
    path: '*',
    element: (
      <Navigate
        to="/"
        replace
      />
    ),
    children: [] as RouteObject[],
  },
];

applicationMap.forEach((groups) => {
  groups.items.forEach((item) => {
    if (environment === 'node') {
      routes[0].children.push({
        path: '/',
        element: <NodeLandingPage />,
      });
    }
    if (item.path && item.element) {
      routes[0].children.push({
        path: item.overwritePath ? item.overwritePath : groups.path + '/' + item.path,
        element: item.element,
      });
    }
  });
});

routes[0].children.push({
  path: '/tos',
  element: <TermsOfService />,
});

const router = createBrowserRouter(routes);

export default router;
