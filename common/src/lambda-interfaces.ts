import { ServerRecordState } from "./database-tables";

/*
===========================
  ServerManagement Lambda
===========================
*/
export type ServerManagementRequest =
  | {
      create: CreateServerRecordRequest;
    }
  | {
      updateState: UpdateStateRequest;
    }
  | {
      updateActive: UpdateActiveRequest;
    };

export interface CreateServerRecordRequest {
  serverUuid: string;
}

export interface UpdateStateRequest {
  serverUuid: string;
  targetState: Exclude<ServerRecordState, "ACTIVE">;
}

export interface UpdateActiveRequest {
  serverUuid: string;
  resumeToken: string;
}
