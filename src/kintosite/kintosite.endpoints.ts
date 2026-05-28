import { HttpEndpointDefinition } from './kintosite.types';

const remoteId = 'kinto' as const;
const type = 'https' as const;

export const kintoAuthLoginEndpointId = 'auth.login';

export const kintoEndpoints: HttpEndpointDefinition[] = [
  {
    id: kintoAuthLoginEndpointId,
    method: 'GET',
    path: '/auth',
    params: {
      token: '{{token}}',
    },
  },
];
