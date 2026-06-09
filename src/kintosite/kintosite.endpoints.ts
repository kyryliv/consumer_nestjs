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

  {
    id: "asset.get",
    method: "GET",
    path: "/asset/{{isin}}",
  },

  {
    id: "asset.update",
    method: "PUT",
    path: "/asset/{{isin}}",
    data: {
      asset: "{{asset}}",
    },
  },

  {
    id: "asset.create",
    method: "POST",
    path: "/asset/{{isin}}",
    data: {
      asset: "{{asset}}",
    },
  },


];
