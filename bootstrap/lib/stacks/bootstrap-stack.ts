import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import { GithubIntegration } from "../constructs/github-integration";
import { StateManagement } from "../constructs/state-management";

export class BootstrapStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new GithubIntegration(this, "GithubIntegration");
    new StateManagement(this, "StateManagement");
  }
}
