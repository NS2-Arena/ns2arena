import { Construct } from "constructs";
import { BaseLambdaFunction } from "../../base-lambda/base-lambda";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { DynamoTableFetcher } from "../../dynamo-table/dynamo-tables-fetcher";
import { NagSuppressions } from "cdk-nag";

export class UpdateStateActive extends BaseLambdaFunction {
  constructor(scope: Construct, id: string) {
    const dynamoTables = DynamoTableFetcher.getInstance(scope).getTables();

    super(scope, id, {
      entry: `${__dirname}/src/index.ts`,
    });

    dynamoTables.Servers.grantWriteData(this.function);

    NagSuppressions.addResourceSuppressions(this.function, [
      {
        id: "Serverless-LambdaDLQ",
        reason: "DLQ is not required",
      },
      {
        id: "NIST.800.53.R5-LambdaDLQ",
        reason: "DLQ is not required",
      },
    ]);
  }
}
