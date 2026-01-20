import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as common from "../../common";
import * as path from "path";

interface EnvironmentVariables {
  [key: string]: pulumi.Input<string>;
}

interface LambdaFunctionArgs {
  region: string;
  statements: pulumi.Input<aws.types.input.iam.GetPolicyDocumentStatementArgs>[];
  environment?: {
    variables: EnvironmentVariables;
  };
  functionName: string;
}

export class LambdaFunction extends pulumi.ComponentResource {
  public readonly function: aws.lambda.Function;

  constructor(
    name: string,
    args: LambdaFunctionArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("ns2arena:compute:LambdaFunction", name, args, opts);

    const { region, functionName } = args;

    const logGroup = new aws.cloudwatch.LogGroup(
      `${name}-lambda-log-group`,
      { name: `/NS2Arena/Lambda/${args.functionName}/${region}` },
      { parent: this },
    );
    const executionRole = new aws.iam.Role(
      `${name}-execution-role`,
      {
        name: `${functionName}-execution-role-${region}`,
        assumeRolePolicy: common.policy_helpers.Role.servicePrincipal(
          "lambda.amazonaws.com",
        ),
        inlinePolicies: [
          {
            policy: aws.iam.getPolicyDocumentOutput({
              statements: [
                common.policy_helpers.LogGroup.grantWrite(logGroup),
                ...args.statements,
              ],
            }).json,
          },
        ],
      },
      { parent: this },
    );

    this.function = new aws.lambda.Function(
      `${name}-lambda`,
      {
        name: functionName,
        role: executionRole.arn,
        loggingConfig: {
          logGroup: logGroup.name,
          logFormat: "JSON",
        },
        environment: {
          ...args.environment,
        },
        runtime: "nodejs24.x",
        handler: "index.handler",
        architectures: ["arm64"],
        packageType: "Zip",
        code: new pulumi.asset.FileArchive(
          path.join(
            __dirname,
            `../../../lambda-functions/dist/${functionName}/`,
          ),
        ),
      },
      { parent: this },
    );
  }
}
