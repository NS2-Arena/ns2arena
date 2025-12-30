import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface DynamoTablesArgs {
  replicationRegions: string[];
}

interface CreateTableArgs {
  tableName: string;
  replicationRegions: string[];
  hashKey: string;
  attributes: aws.types.input.dynamodb.TableAttribute[];
}

export class DynamoTables extends pulumi.ComponentResource {
  public readonly servers: aws.dynamodb.Table;

  constructor(
    name: string,
    args: DynamoTablesArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("ns2arena:storage:DynamoTables", name, args, opts);

    this.servers = this.createTable(name, {
      tableName: "servers",
      replicationRegions: args.replicationRegions,
      hashKey: "id",
      attributes: [{ name: "id", type: "S" }],
    });
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
      { parent: this }
    );
  }
}
