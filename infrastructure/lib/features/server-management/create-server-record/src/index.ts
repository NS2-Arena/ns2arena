import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ServerRecord, LambdaHandler } from "@ns2arena/common";

interface CreateServerRecordRequest {
  serverUuid: string;
}

export const handler: LambdaHandler<void, CreateServerRecordRequest> = async (
  event
) => {
  const { serverUuid } = event;

  const client = new DynamoDBClient();
  const docClient = DynamoDBDocumentClient.from(client);

  const record: ServerRecord = {
    id: serverUuid,
    state: "PROVISIONING",
  };

  const input = new PutCommand({
    TableName: process.env.ServersTableName!,
    Item: record,
    ConditionExpression: "attribute_not_exists(id)",
  });
  await docClient.send(input);
};
