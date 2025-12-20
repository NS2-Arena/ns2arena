import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as common from "../../common";

export class ServerManagement extends pulumi.ComponentResource {
  constructor(name: string, args: {}, opts?: pulumi.ComponentResourceOptions) {
    super("ns2arena:compute:ServerManagement", name, args, opts);

    const definition = "";
    const role = new aws.iam.Role(
      `${name}-role`,
      {
        assumeRolePolicy: common.policy_helpers.Role.servicePrincipal(
          "states.amazonaws.com"
        ),
        inlinePolicies: [],
      },
      { parent: this }
    );

    new aws.sfn.StateMachine(
      `${name}-state-machine`,
      {
        definition,
        roleArn: role.arn,
      },
      { parent: this }
    );
  }
}
