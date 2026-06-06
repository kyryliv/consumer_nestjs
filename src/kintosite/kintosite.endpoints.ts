import { HttpEndpointDefinition } from "./kintosite.types";

const type = "https" as const;

export const kintoEndpoints: HttpEndpointDefinition[] = [
  {
    id: "funds_list.update",
    method: "POST",
    path: "/funds_list/update",
    data: {
      funds_list: "{{funds_list}}",
    },
  },

  {
    id: "shoporders.update",
    method: "POST",
    path: "/shoporders/update",
    data: {
      shoporders: "{{shoporders}}",
    },
  },
];
