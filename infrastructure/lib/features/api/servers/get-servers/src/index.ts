import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ServerRecord } from "@ns2-arena/common";
import { GetServersResponse } from "@ns2-arena/common";
import { httpHandler } from "@ns2-arena/common";

export const handler = httpHandler<GetServersResponse>(async () => {
  const client = new DynamoDBClient();
  const docClient = DynamoDBDocumentClient.from(client);

  const input = new ScanCommand({
    TableName: process.env.ServersTableName!,
  });
  const items = await docClient.send(input);

  return {
    statusCode: 200,
    body: {
      items: items.Items! as unknown as ServerRecord[],
    },
  };
});
