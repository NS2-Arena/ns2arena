import { Construct } from "constructs";
import { BaseLambdaFunction } from "../../base-lambda/base-lambda";
import { DynamoTableFetcher } from "../../dynamo-table/dynamo-tables-fetcher";

export class UpdateStatePending extends BaseLambdaFunction {
  constructor(scope: Construct, id: string) {
    const dynamoTables = DynamoTableFetcher.getInstance(scope).getTables();

    super(scope, id, {
      entry: `${__dirname}/src/index.ts`,
    });

    dynamoTables.Servers.grantWriteData(this.function);
  }
}
