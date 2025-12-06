import {
  Cors,
  LambdaIntegration,
  PassthroughBehavior,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import { GetServers } from "./get-servers/get-servers";
import { ProvisionServer } from "./provision-server/provision-server";
import { RegionInfo } from "../../../../bin/variables";

interface ServersApiProps {
  api: RestApi;
  computeRegions: RegionInfo[];
}

export class ServersApi extends Construct {
  constructor(scope: Construct, id: string, props: ServersApiProps) {
    super(scope, id);

    const { api, computeRegions } = props;

    const getServersFunction = new GetServers(this, "GetServersFunction");
    const provisionServerFunction = new ProvisionServer(
      this,
      "ProvisionServerFunction",
      {
        computeRegions,
      }
    );

    const root = api.root.addResource("server");

    root.addMethod(
      "GET",
      new LambdaIntegration(getServersFunction.function, {
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
      })
    );

    root.addMethod(
      "POST",
      new LambdaIntegration(provisionServerFunction.function, {
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
      })
    );

    root.addCorsPreflight({
      allowOrigins: Cors.ALL_ORIGINS,
      allowMethods: ["OPTIONS", "GET", "POST"],
    });
  }
}
