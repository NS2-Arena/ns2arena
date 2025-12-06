import {
  AttributeType,
  Billing,
  TablePropsV2,
  TableV2,
} from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { SSMParameterWriter } from "../ssm-parameter-management/ssm-parameter-writer";
import { SSMParameters } from "@ns2-arena/common";

interface NS2ArenaDynamoTableProps {
  readonly tableName: string;
  readonly replicationRegions: string[];
  readonly tableProps?: TablePropsV2;
}

export class NS2ArenaDynamoTable extends Construct {
  public readonly table: TableV2;

  constructor(scope: Construct, id: string, props: NS2ArenaDynamoTableProps) {
    super(scope, id);

    const { tableName, tableProps, replicationRegions } = props;

    this.table = new TableV2(this, "Table", {
      ...tableProps,
      partitionKey: { name: "id", type: AttributeType.STRING },
      deletionProtection: true,
      replicas: replicationRegions.map((region) => ({ region: region })),
      billing: Billing.onDemand(),
    });

    SSMParameterWriter.writeStringParameter(this, "TableNameParameter", {
      stringValue: this.table.tableName,
      parameterName: SSMParameters.Tables.Servers.Name,
    });

    SSMParameterWriter.writeStringParameter(this, "TableArnParameter", {
      stringValue: this.table.tableArn,
      parameterName: SSMParameters.Tables.Servers.Arn,
    });

    replicationRegions.forEach((region) => {
      const replicaTable = this.table.replica(region);
      SSMParameterWriter.writeStringParameter(
        this,
        `TableNameParameter${region}`,
        {
          stringValue: replicaTable.tableName,
          parameterName: SSMParameters.Tables.Servers.Name,
          region,
        }
      );

      SSMParameterWriter.writeStringParameter(
        this,
        `TableArnParameter${region}`,
        {
          stringValue: replicaTable.tableArn,
          parameterName: SSMParameters.Tables.Servers.Arn,
          region,
        }
      );
    });
  }
}
