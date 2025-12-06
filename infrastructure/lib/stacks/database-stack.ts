import { App } from "aws-cdk-lib";
import { BaseStack, BaseStackProps } from "./base-stack";
import { NS2ArenaDynamoTable } from "../features/dynamo-table/dynamo-table";

interface DatabaseStackProps extends BaseStackProps {
  replicationRegions: string[];
}

export class DatabaseStack extends BaseStack {
  constructor(scope: App, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { replicationRegions } = props;

    new NS2ArenaDynamoTable(this, "ServersTable", {
      tableName: "Servers",
      replicationRegions,
    });
  }
}
