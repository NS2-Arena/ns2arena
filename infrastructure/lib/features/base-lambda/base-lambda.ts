import { Duration } from "aws-cdk-lib";
import { Architecture } from "aws-cdk-lib/aws-lambda";
import {
  NodejsFunction,
  NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { DynamoTableFetcher } from "../dynamo-table/dynamo-tables-fetcher";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

export interface BaseLambdaFunctionProps {
  entry: string;
  policyStatements?: PolicyStatement[];
  additionalProps?: NodejsFunctionProps;
}

export class BaseLambdaFunction extends Construct {
  public readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, props: BaseLambdaFunctionProps) {
    super(scope, id);

    const { entry, policyStatements, additionalProps } = props;

    this.function = new NodejsFunction(this, "Function", {
      architecture: Architecture.ARM_64,
      memorySize: 128,
      timeout: Duration.seconds(15),
      handler: "index.handler",
      entry: entry,
      ...additionalProps,
    });

    if (policyStatements !== undefined) {
      policyStatements.forEach((statement) =>
        this.function.addToRolePolicy(statement)
      );
    }

    const dynamoTables = DynamoTableFetcher.getInstance(this).getTables();
    Object.entries(dynamoTables).forEach(([name, table]) => {
      this.function.addEnvironment(`${name}TableName`, table.tableName);
    });
  }
}
