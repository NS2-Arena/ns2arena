import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ServerRecordState } from "@ns2arena/common";
import { LambdaHandler } from "@ns2arena/common";

interface UpdateStateActiveEvent {
  serverUuid: string;
  resumeToken: string;
}

export const handler: LambdaHandler<void, UpdateStateActiveEvent> = async (
  event
) => {
  const { serverUuid, resumeToken } = event;

  const client = new DynamoDBClient();
  const docClient = DynamoDBDocumentClient.from(client);

  const input = new UpdateCommand({
    TableName: process.env.ServersTableName!,
    Key: { id: serverUuid },
    UpdateExpression: "SET #state = :state, #resumeToken = :resumeToken",
    ExpressionAttributeNames: {
      "#state": "state",
      "#resumeToken": "resumeToken",
    },
    ExpressionAttributeValues: {
      ":state": "ACTIVE" as ServerRecordState,
      ":resumeToken": resumeToken,
    },
    ConditionExpression: "attribute_exists(id)",
  });
  await docClient.send(input);
};
