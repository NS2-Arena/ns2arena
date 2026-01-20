import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as common from "../../common";
import * as arena_common from "@ns2arena/common";
import { Tables } from "../database/dynamo-tables";
import { LambdaFunction } from "../lambda/function";

interface ServerManagementArgs {
  taskRole: aws.iam.Role;
  region: string;
  tables: Tables;
  launchTemplate: aws.ec2.LaunchTemplate;
  iamInstanceProfileRole: aws.iam.Role;
  securityGroup: aws.ec2.SecurityGroup;
  cluster: aws.ecs.Cluster;
  taskDefinition: aws.ecs.TaskDefinition;
}

interface CreateStateMachineArgs {
  taskRole: aws.iam.Role;
  region: string;
  serverManagementLambda: aws.lambda.Function;
  launchTemplate: aws.ec2.LaunchTemplate;
  iamInstanceProfileRole: aws.iam.Role;
  securityGroup: aws.ec2.SecurityGroup;
  cluster: aws.ecs.Cluster;
  taskDefinition: aws.ecs.TaskDefinition;
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
      taskDefinition,
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
      taskDefinition,
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
      serverManagementLambda,
      launchTemplate,
      iamInstanceProfileRole,
      securityGroup,
      cluster,
      taskDefinition,
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
          lambda: serverManagementLambda,
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
          chain: { next: "RunServer" },
          lambda: serverManagementLambda,
          payload: {
            updateState: {
              serverUuid: "{% $serverUuid %}",
              targetState: "PENDING",
            },
          } satisfies arena_common.lambda_interfaces.ServerManagementRequest,
        }),
        new common.sfn_tasks.RunTask({
          name: "RunServer",
          chain: { next: "UpdateStateActive" },
          cluster,
          taskDefinition,
          overrides: {
            ContainerOverrides: [
              {
                Name: "ns2-server",
                Environment: [
                  {
                    Name: "NAME",
                    Value: "{% $inputArgs.name %}",
                  },
                  {
                    Name: "PASSWORD",
                    Value: "{% $inputArgs.password %}",
                  },
                  {
                    Name: "LAUNCH_CONFIG",
                    Value: "{% $inputArgs.launchConfig %}",
                  },
                  {
                    Name: "MAP",
                    Value: "{% $inputArgs.map %}",
                  },
                  {
                    Name: "TASK_TOKEN",
                    Value: "{% $states.context.Task.Token %}",
                  },
                ],
              },
            ],
          },
          propagateTags: "TASK_DEFINITION",
          launchType: "EC2",
          placementConstraints: [
            {
              Type: "memberOf",
              Expression: "{% 'ec2InstanceId ==' & $InstanceId %}",
            },
          ],
          assign: {
            TaskArn: "{% $states.result.TaskARN %}",
          },
          integrationPattern: "WAIT_FOR_TASK_TOKEN",
        }),
        new common.sfn_tasks.InvokeLambda({
          name: "UpdateStateActive",
          chain: { next: "UpdateStateDeprovisioning" },
          integrationPattern: "WAIT_FOR_TASK_TOKEN",
          lambda: serverManagementLambda,
          payload: {
            updateActive: {
              serverUuid: "{% $serverUuid %}",
              resumeToken: "{% $states.context.Task.Token %}",
            },
          } satisfies arena_common.lambda_interfaces.ServerManagementRequest,
        }),
        new common.sfn_tasks.InvokeLambda({
          name: "UpdateStateDeprovisioning",
          chain: { end: true },
          lambda: serverManagementLambda,
          payload: {
            updateState: {
              serverUuid: "{% $serverUuid %}",
              targetState: "DEPROVISIONING",
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
