import { HttpEndpointDefinition } from './kintosite.types';

const type = 'https' as const;

export const kintoEndpoints: HttpEndpointDefinition[] = [
  {
    id: 'shoporders.update',
    method: 'POST',
    path: '/shoporders/update',
    params: {
      shoporders: '{{shoporders}}',
    },
  },
];
