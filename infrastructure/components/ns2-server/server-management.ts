import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as common from "../../common";
import * as path from "path";
import { DynamoTables } from "../database/dynamo-tables";

interface ServerManagementArgs {
  taskRole: aws.iam.Role;
  region: string;
  tables: DynamoTables;
  launchTemplate: aws.ec2.LaunchTemplate;
  iamInstanceProfile: aws.iam.InstanceProfile;
  securityGroup: aws.ec2.SecurityGroup;
}

interface CreateStateMachineArgs {
  taskRole: aws.iam.Role;
  region: string;
  lambda: aws.lambda.Function;
  launchTemplate: aws.ec2.LaunchTemplate;
  iamInstanceProfile: aws.iam.InstanceProfile;
  securityGroup: aws.ec2.SecurityGroup;
}

interface CreateLambdaArgs {
  region: string;
  tables: DynamoTables;
}

export class ServerManagement extends pulumi.ComponentResource {
  public stateMachine: aws.sfn.StateMachine;

  constructor(
    name: string,
    args: ServerManagementArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("ns2arena:compute:ServerManagement", name, args, opts);

    const {
      taskRole,
      region,
      tables,
      launchTemplate,
      iamInstanceProfile,
      securityGroup,
    } = args;

    const lambda = this.createLambda(name, { region, tables });
    this.stateMachine = this.createStateMachine(name, {
      taskRole,
      region,
      lambda,
      launchTemplate,
      iamInstanceProfile,
      securityGroup,
    });
  }

  private createLambda(name: string, args: CreateLambdaArgs) {
    const { region, tables } = args;

    const logGroup = new aws.cloudwatch.LogGroup(
      `${name}-lambda-log-group`,
      { name: `/NS2Arena/Lambda/ServerManagement/${region}` },
      { parent: this }
    );
    const executionRole = new aws.iam.Role(
      `${name}-execution-role`,
      {
        name: `server-management-lambda-execution-role-${region}`,
        assumeRolePolicy: common.policy_helpers.Role.servicePrincipal(
          "lambda.amazonaws.com"
        ),
        inlinePolicies: [
          {
            policy: aws.iam.getPolicyDocumentOutput({
              statements: [
                common.policy_helpers.LogGroup.grantWrite(logGroup),
                common.policy_helpers.DynamoTable.grantCRUD(tables.servers),
              ],
            }).json,
          },
        ],
      },
      { parent: this }
    );

    const lambda = new aws.lambda.Function(
      `${name}-lambda`,
      {
        name: "server-management",
        role: executionRole.arn,
        loggingConfig: {
          logGroup: logGroup.name,
          logFormat: "JSON",
        },
        environment: {
          variables: {
            ServersTableName: tables.servers.name,
          },
        },
        runtime: "python3.14",
        handler: "index.handler",
        architectures: ["arm64"],
        packageType: "Zip",
        code: new pulumi.asset.FileArchive(
          path.join(__dirname, "./server-management-lambda")
        ),
      },
      { parent: this }
    );

    return lambda;
  }

  private createStateMachine(name: string, args: CreateStateMachineArgs) {
    const {
      taskRole,
      region,
      lambda,
      launchTemplate,
      iamInstanceProfile,
      securityGroup,
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
          chain: { next: "InvokeLambdaTest" },
        }),
        new common.sfn_tasks.InvokeLambda({
          name: "CreateServerRecord",
          chain: { next: "CreateInstance" },
          lambda,
          payload: {
            requestType: "create",
          },
        }),
        new common.sfn_tasks.RunInstance({
          name: "CreateInstance",
          chain: { next: "WaitForInstance" },
          launchTemplate,
          iamInstanceProfile,
          maxCount: 1,
          minCount: 1,
          securityGroup,
        }),
        // new common.sfn_tasks.Wait({
        //   name: "WaitForInstance",
        //   chain: { end: true },
        //   duration: 123,
        // }),
      ],
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

    return stateMachine;
  }
}
