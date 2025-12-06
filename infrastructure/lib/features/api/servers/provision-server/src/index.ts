import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { ProvisionServerRequest } from "@ns2-arena/common";
import { httpHandler } from "@ns2-arena/common";

export const handler = httpHandler<undefined>(async (event) => {
  if (event.body === null) throw new Error("Missing request");

  const request: ProvisionServerRequest = JSON.parse(event.body);
  const stateMachineArn =
    process.env[`StateMachineArn${request.region.replaceAll("-", "")}`];

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
      }),
    })
  );

  return {
    statusCode: 200,
  };
});
