import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as arena_common from "@ns2arena/common";

interface DynamoTablesArgs {
  replicationRegions: string[];
}

interface CreateTableArgs {
  tableName: string;
  replicationRegions: string[];
  hashKey: string;
  attributes: aws.types.input.dynamodb.TableAttribute[];
}

export type Tables = {
  [key in arena_common.tables.TableName]: aws.dynamodb.Table;
};

export class DynamoTables extends pulumi.ComponentResource {
  public readonly tables: Tables;

  constructor(
    name: string,
    args: DynamoTablesArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("ns2arena:storage:DynamoTables", name, args, opts);

    const servers = this.createTable(name, {
      tableName: "servers",
      replicationRegions: args.replicationRegions,
      hashKey: "id",
      attributes: [{ name: "id", type: "S" }],
    });

    this.tables = {
      servers,
    };
  }

  private createTable(name: string, args: CreateTableArgs): aws.dynamodb.Table {
    const { tableName, replicationRegions, hashKey, attributes } = args;

    return new aws.dynamodb.Table(
      `${name}-${tableName}`,
      {
        name: tableName,
        hashKey,
        attributes,
        billingMode: "PAY_PER_REQUEST",
        streamEnabled: true,
        streamViewType: "NEW_AND_OLD_IMAGES",
        replicas: replicationRegions.map((region) => ({
          regionName: region,
        })),
        deletionProtectionEnabled: false,
      },
      { parent: this },
    );
  }
}
