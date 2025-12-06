import { ITable, Table } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { SSMParameters } from "@ns2-arena/common";
import { Stack } from "aws-cdk-lib";
import { SSMParameterReader } from "../ssm-parameter-management/ssm-parameter-reader";

type DynamoTables = {
  Servers: ITable;
};
type DynamoTableNames = keyof DynamoTables;

export class DynamoTableFetcher {
  private static instance: DynamoTableFetcher;
  private static stackLogicalId: string;
  private tables: DynamoTables;

  public static getInstance(scope: Construct): DynamoTableFetcher {
    const stackId = Stack.of(scope).node.id;
    if (
      DynamoTableFetcher.instance === undefined ||
      stackId !== DynamoTableFetcher.stackLogicalId
    ) {
      DynamoTableFetcher.instance = new DynamoTableFetcher(scope);
      DynamoTableFetcher.stackLogicalId = stackId;
    }

    return DynamoTableFetcher.instance;
  }

  constructor(scope: Construct) {
    // Fetch all tables from SSM Paramters
    type TableInfo = {
      [key in DynamoTableNames]: string;
    };

    const tableParameters: TableInfo = {
      Servers: SSMParameters.Tables.Servers.Arn,
    };

    this.tables = Object.fromEntries(
      Object.entries(tableParameters).map(([tableName, parameterName]) => {
        const tableArn = SSMParameterReader.readStringParameter(
          scope,
          `${tableName}Arn`,
          {
            parameterName,
          }
        );
        const table = Table.fromTableArn(scope, tableName, tableArn);

        return [tableName, table];
      })
    ) as DynamoTables;
  }

  public getTables(): DynamoTables {
    return this.tables;
  }
}
