import { HttpEndpointDefinition } from './kintosite.types';

const type = 'https' as const;

export const kintoEndpoints: HttpEndpointDefinition[] = [
  {
    id: 'funds_list.update',
    method: 'POST',
    path: '/funds_list/update',
    params: {
      funds_list: '{{funds_list}}',
    },
  },

  {
    id: 'shoporders.update',
    method: 'POST',
    path: '/shoporders/update',
    params: {
      shoporders: '{{shoporders}}',
    },
  },
];
