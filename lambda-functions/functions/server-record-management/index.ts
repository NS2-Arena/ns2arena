import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  PutCommand,
  DynamoDBDocumentClient,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import * as common from "@ns2arena/common";
import { LambdaHandler } from "../../common/lambda-integration";

const serverTableName = "servers" satisfies common.tables.TableName;

export const handler: LambdaHandler<
  void,
  common.lambda_interfaces.ServerManagementRequest
> = async (event) => {
  if ("create" in event) await handleCreate(event.create);
  else if ("updateState" in event) await handleUpdate(event.updateState);
  else if ("updateActive" in event)
    await handleUpdateActive(event.updateActive);
  else throw Error("Unknown event type");
};

const handleCreate = async (
  event: common.lambda_interfaces.CreateServerRecordRequest,
) => {
  const { serverUuid } = event;

  const client = new DynamoDBClient();
  const docClient = DynamoDBDocumentClient.from(client);

  const record: common.tables.ServerRecord = {
    id: serverUuid,
    state: "PROVISIONING",
    resumeToken: "",
  };

  const input = new PutCommand({
    TableName: serverTableName,
    Item: record,
    ConditionExpression: "attribute_not_exists(id)",
  });
  await docClient.send(input);
};

const handleUpdate = async (
  event: common.lambda_interfaces.UpdateStateRequest,
) => {
  const { serverUuid, targetState } = event;

  const client = new DynamoDBClient();
  const docClient = DynamoDBDocumentClient.from(client);

  const input = new UpdateCommand({
    TableName: serverTableName,
    Key: { id: serverUuid },
    UpdateExpression: "SET #state = :state",
    ExpressionAttributeNames: {
      "#state": "state",
    },
    ExpressionAttributeValues: {
      ":state": targetState,
    },
    ConditionExpression: "attribute_exists(id)",
  });
  await docClient.send(input);
};

const handleUpdateActive = async (
  event: common.lambda_interfaces.UpdateActiveRequest,
) => {
  const { serverUuid, resumeToken } = event;

  const client = new DynamoDBClient();
  const docClient = DynamoDBDocumentClient.from(client);

  const input = new UpdateCommand({
    TableName: serverTableName,
    Key: { id: serverUuid },
    UpdateExpression: "SET #state = :state, #resumeToken = :resumeToken",
    ExpressionAttributeNames: {
      "#state": "state",
      "#resumeToken": "resumeToken",
    },
    ExpressionAttributeValues: {
      ":state": "ACTIVE" as common.tables.ServerRecordState,
      ":resumeToken": resumeToken,
    },
    ConditionExpression: "attribute_exists(id)",
  });
  await docClient.send(input);
};
