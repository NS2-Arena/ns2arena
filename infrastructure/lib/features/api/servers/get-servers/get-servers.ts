import { Construct } from "constructs";
import { DynamoTableFetcher } from "../../../dynamo-table/dynamo-tables-fetcher";
import { BaseLambdaFunction } from "../../../base-lambda/base-lambda";

export class GetServers extends BaseLambdaFunction {
  constructor(scope: Construct, id: string) {
    const dynamoTables = DynamoTableFetcher.getInstance(scope).getTables();

    super(scope, id, {
      entry: `${__dirname}/src/index.ts`,
    });

    dynamoTables.Servers.grantReadData(this.function);
  }
}
