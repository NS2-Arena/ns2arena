import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import {
  httpHandler,
  ProvisionServerRequest,
  ProvisionServerResponse,
} from "@ns2arena/common";
import { v4 as uuidv4 } from "uuid";

export const handler = httpHandler<ProvisionServerResponse>(async (event) => {
  if (event.body === null) throw new Error("Missing request");

  const request: ProvisionServerRequest = JSON.parse(event.body);
  const stateMachineArn =
    process.env[`StateMachineArn${request.region.replaceAll("-", "")}`];
  const serverUuid = uuidv4();

  console.log(`Server UUID = ${serverUuid}`);

  const client = new SFNClient({
    region: request.region,
  });
  await client.send(
    new StartExecutionCommand({
      stateMachineArn,
      input: JSON.stringify({
        name: request.serverName,
        password: request.password,
        map: request.map,
        launchConfig: request.launchConfig,
        serverUuid,
      }),
    })
  );

  return {
    statusCode: 200,
    body: {
      serverUuid,
    },
  };
});
