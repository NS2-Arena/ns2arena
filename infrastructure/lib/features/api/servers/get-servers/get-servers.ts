import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";
import { DynamoTableFetcher } from "../../../dynamo-table/dynamo-tables-fetcher";
import { BaseLambdaFunction } from "../../../base-lambda/base-lambda";

export class GetServers extends BaseLambdaFunction {
  constructor(scope: Construct, id: string) {
    const dynamoTables = DynamoTableFetcher.getInstance(scope).getTables();

    super(scope, id, {
      entry: `${__dirname}/src/index.ts`,
    });

    dynamoTables.Servers.grantReadData(this.function);

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
