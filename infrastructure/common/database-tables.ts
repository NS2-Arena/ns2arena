/**
 * List of valid table names
 */
export const TABLE_NAMES = ["servers"] as const;
export type TableName = (typeof TABLE_NAMES)[number];

export function getEnvironmentVariableForName(name: TableName) {
  return `${name}TableName`;
}

export function getNameFromEnvironment(name: TableName) {
  return process.env[getEnvironmentVariableForName(name)];
}

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
