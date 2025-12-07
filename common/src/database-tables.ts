/**
 * ServerRecordState
 */
export type ServerRecordState =
  | "PENDING"
  | "PROVISIONING"
  | "ACTIVE"
  | "DEPROVISIONING";

/**
 * ServerRecord
 */
export type ServerRecord = {
  id: string;
  state: ServerRecordState;
};
