import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as common from "../../common";
import * as arena_common from "@ns2arena/common";
import * as path from "path";
import { DynamoTables, Tables } from "../database/dynamo-tables";
import { LambdaFunction } from "../lambda/function";

interface ServerManagementArgs {
  taskRole: aws.iam.Role;
  region: string;
  tables: Tables;
  launchTemplate: aws.ec2.LaunchTemplate;
  iamInstanceProfileRole: aws.iam.Role;
  securityGroup: aws.ec2.SecurityGroup;
  cluster: aws.ecs.Cluster;
}

interface CreateStateMachineArgs {
  taskRole: aws.iam.Role;
  region: string;
  serverManagementLambda: aws.lambda.Function;
  launchTemplate: aws.ec2.LaunchTemplate;
  iamInstanceProfileRole: aws.iam.Role;
  securityGroup: aws.ec2.SecurityGroup;
  cluster: aws.ecs.Cluster;
}

interface CreateLambdaArgs {
  region: string;
  tables: Tables;
}

export class ServerManagement extends pulumi.ComponentResource {
  public stateMachine: aws.sfn.StateMachine;

  constructor(
    name: string,
    args: ServerManagementArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("ns2arena:compute:ServerManagement", name, args, opts);

    const {
      taskRole,
      region,
      tables,
      launchTemplate,
      iamInstanceProfileRole,
      securityGroup,
      cluster,
    } = args;

    const lambda = this.createLambda(name, { region, tables });
    this.stateMachine = this.createStateMachine(name, {
      taskRole,
      region,
      serverManagementLambda: lambda,
      launchTemplate,
      iamInstanceProfileRole,
      securityGroup,
      cluster,
    });
  }

  private createLambda(name: string, args: CreateLambdaArgs) {
    const { region, tables } = args;

    return new LambdaFunction(
      `${name}-lambda`,
      {
        region,
        statements: [
          common.policy_helpers.DynamoTable.grantCRUD(tables.servers),
        ],
        functionName: "server-record-management",
      },
      { parent: this },
    ).function;
  }

  private createStateMachine(name: string, args: CreateStateMachineArgs) {
    const {
      taskRole,
      region,
      serverManagementLambda: lambda,
      launchTemplate,
      iamInstanceProfileRole,
      securityGroup,
      cluster,
    } = args;

    const { definition, statements } = common.state_machine.createDefinition({
      comment: "Create Server",
      startAt: "AssignInputVars",
      tasks: [
        new common.sfn_tasks.Pass({
          name: "AssignInputVars",
          assign: {
            inputArgs: {
              name: "{% $states.input.name %}",
              password: "{% $states.input.password %}",
              launchConfig: "{% $states.input.launchConfig %}",
              map: "{% $states.input.map %}",
            },
            serverUuid: "{% $states.input.serverUuid %}",
          },
          chain: { next: "CreateServerRecord" },
        }),
        new common.sfn_tasks.InvokeLambda({
          name: "CreateServerRecord",
          chain: { next: "CreateInstance" },
          lambda,
          payload: {
            create: {
              serverUuid: "{% $serverUuid %}",
            },
          } satisfies arena_common.lambda_interfaces.ServerManagementRequest,
        }),
        new common.sfn_tasks.RunInstance({
          name: "CreateInstance",
          chain: { next: "WaitForInstance" },
          launchTemplate,
          iamInstanceProfileRole,
          maxCount: 1,
          minCount: 1,
          securityGroup,
          assign: {
            InstanceId: "{% $states.result.Instances[0].InstanceId %}",
          },
        }),
        new common.sfn_tasks.Wait({
          name: "WaitForInstance",
          chain: { next: "ListContainerInstances" },
          seconds: 3,
        }),
        new common.sfn_tasks.ListContainerInstances({
          name: "ListContainerInstances",
          chain: { next: "IsInstanceRunning" },
          output: {
            ContainerInstanceArns: "{% $states.result.ContainerInstanceArns %}",
          },
          cluster,
          filter: "{% 'ec2InstanceId ==' & $InstanceId %}",
        }),
        new common.sfn_tasks.Choice({
          name: "IsInstanceRunning",
          default: "WaitForInstance",
          choices: [
            {
              Condition:
                "{% $count($states.input.ContainerInstanceArns) = 1 %}",
              Next: "UpdateStatePending",
            },
          ],
        }),
        new common.sfn_tasks.InvokeLambda({
          name: "UpdateStatePending",
          chain: { end: true },
          lambda,
          payload: {
            updateState: {
              serverUuid: "{% $serverUuid %}",
              targetState: "PENDING",
            },
          } satisfies arena_common.lambda_interfaces.ServerManagementRequest,
        }),
      ],
    });

    const role = new aws.iam.Role(
      `${name}-role`,
      {
        name: `server-management-state-machine-role-${region}`,
        assumeRolePolicy: common.policy_helpers.Role.servicePrincipal(
          "states.amazonaws.com",
        ),
        inlinePolicies: [
          { policy: aws.iam.getPolicyDocumentOutput({ statements }).json },
        ],
      },
      { parent: this },
    );

    const stateMachine = new aws.sfn.StateMachine(
      `${name}-state-machine`,
      {
        definition,
        roleArn: role.arn,
      },
      { parent: this },
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
      { parent: this },
    );

    return stateMachine;
  }
}
