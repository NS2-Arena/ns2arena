import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ServerRecordState } from "@ns2-arena/common";
import { LambdaHandler } from "@ns2-arena/common";

interface UpdateStateDeprovisioningEvent {
  serverUuid: string;
}

export const handler: LambdaHandler<
  void,
  UpdateStateDeprovisioningEvent
> = async (event) => {
  const serverUuid = event.serverUuid;

  const client = new DynamoDBClient();
  const docClient = DynamoDBDocumentClient.from(client);

  const input = new UpdateCommand({
    TableName: process.env.ServersTableName!,
    Key: { id: serverUuid },
    UpdateExpression: "SET #state = :state",
    ExpressionAttributeNames: {
      "#state": "state",
    },
    ExpressionAttributeValues: {
      ":state": "DEPROVISIONING" as ServerRecordState,
    },
    ConditionExpression: "attribute_exists(id)",
  });
  await docClient.send(input);
};
