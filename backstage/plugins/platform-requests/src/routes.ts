import { createRouteRef } from '@backstage/frontend-plugin-api';

export const rootRouteRef = createRouteRef();
export const homeRouteRef = createRouteRef();
export const requestRouteRef = createRouteRef({ params: ['id'] });
export const dashboardRouteRef = createRouteRef();
