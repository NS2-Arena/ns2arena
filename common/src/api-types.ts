import { ServerRecord } from "./database-tables";

export type GetServersRequest = void;
export type GetServersResponse = { items: ServerRecord[] };

export type ProvisionServerRequest = {
  region: string;
  serverName: string;
  password: string;
  map: string;
  launchConfig: string;
};
export type ProvisionServerResponse = undefined;
