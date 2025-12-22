import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as common from "../../common";

interface ServerManagementArgs {
  taskRole: aws.iam.Role;
  region: string;
}

export class ServerManagement extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: ServerManagementArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("ns2arena:compute:ServerManagement", name, args, opts);

    const { taskRole, region } = args;

    const { definition, statements } = common.state_machine.createDefinition({
      comment: "Create Server",
      states: [
        // new common.sfn_states.PassState({
        //   name: "TestState",
        //   chain: { next: "InvokeLambdaTest" },
        //   chain: { end: true },
        // }),
        // new common.sfn_states.InvokeLambdaState({
        //   name: "InvokeLambdaTest",
        //   chain: { end: true },
        //   lambda,
        // }),
      ],
      startAt: "TestState",
    });

    const role = new aws.iam.Role(
      `${name}-role`,
      {
        name: `server-management-state-machine-role-${region}`,
        assumeRolePolicy: common.policy_helpers.Role.servicePrincipal(
          "states.amazonaws.com"
        ),
        inlinePolicies: [
          { policy: aws.iam.getPolicyDocumentOutput({ statements }).json },
        ],
      },
      { parent: this }
    );

    const stateMachine = new aws.sfn.StateMachine(
      `${name}-state-machine`,
      {
        definition,
        roleArn: role.arn,
      },
      { parent: this }
    );

    new aws.iam.RolePolicy(
      `${name}-task-role-policy`,
      {
        role: taskRole,
        policy: aws.iam.getPolicyDocumentOutput({
          statements: [
            common.policy_helpers.StateMachine.grantTaskResponse(stateMachine),
          ],
        }).json,
      },
      { parent: this }
    );
  }
}
