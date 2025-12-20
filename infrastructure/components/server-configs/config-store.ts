import * as pulumi from "@pulumi/pulumi";
import * as syncedfolder from "@pulumi/synced-folder";
import * as aws from "@pulumi/aws";
import * as path from "path";
import * as common from "../../common";
import { ConfigStoreBucket } from "./config-store-bucket";

interface ConfigBucketsArgs {
  mainRegion: string;
  replicationRegions: string[];
  computeRegions: string[];
}

export class ConfigStores extends pulumi.ComponentResource {
  public readonly stores: common.types.RegionalData<ConfigStoreBucket>;

  constructor(
    name: string,
    args: ConfigBucketsArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("ns2arena:server-configs:ConfigBuckets", name, args, opts);

    const { mainRegion, replicationRegions, computeRegions } = args;

    this.stores = computeRegions.reduce((prev, region) => {
      const provider = new aws.Provider(
        `${name}-provider-${region}`,
        {
          region,
        },
        { parent: this }
      );

      return {
        ...prev,
        [region]: new ConfigStoreBucket(
          `${name}-config-store-${region}`,
          { region },
          { provider, parent: this }
        ),
      };
    }, {} as common.types.RegionalData<ConfigStoreBucket>);

    const destinationBuckets = replicationRegions.map(
      (region) => this.stores[region].bucket
    );

    const sourceStore = this.stores[mainRegion];

    const replicationRole = new aws.iam.Role(
      `${name}-replication-role`,
      {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
          Service: "s3.amazonaws.com",
        }),
      },
      { parent: this }
    );

    new aws.iam.RolePolicy(
      `${name}-replication-role-policy`,
      {
        role: replicationRole.id,
        policy: pulumi
          .all(destinationBuckets.map((bucket) => bucket.arn))
          .apply((arns) =>
            sourceStore.bucket.arn.apply((sourceStoreArn) =>
              this.replicationPolicy(sourceStoreArn, arns)
            )
          ),
      },
      { parent: this }
    );

    new aws.s3.BucketReplicationConfig(
      `${name}-replication-config`,
      {
        bucket: sourceStore.bucket.id,
        role: replicationRole.arn,
        rules: pulumi
          .all(destinationBuckets.map((bucket) => bucket.arn))
          .apply<aws.types.input.s3.BucketReplicationConfigRule[]>((arns) =>
            arns.map((arn, i) => ({
              destination: {
                bucket: arn,
              },
              filter: {
                prefix: "",
              },
              status: "Enabled",
              deleteMarkerReplication: { status: "Enabled" },
              priority: i,
            }))
          ),
      },
      { parent: this, dependsOn: [sourceStore, ...destinationBuckets] }
    );

    new syncedfolder.S3BucketFolder(
      "server-configs",
      {
        bucketName: sourceStore.bucket.bucket,
        path: path.join(__dirname, "../../../server-configs"),
        acl: aws.s3.CannedAcl.Private,
        managedObjects: false,
      },
      { parent: this }
    );

    this.registerOutputs({
      sourceBucket: sourceStore.bucket,
      destinationBuckets,
    });
  }

  private replicationPolicy(sourceBucketArn: string, arns: string[]) {
    return JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["s3:GetReplicationConfiguration", "s3:ListBucket"],
          Resource: sourceBucketArn,
        },
        {
          Effect: "Allow",
          Action: [
            "s3:GetObjectVersion",
            "s3:GetObjectVersionAcl",
            "s3:GetObjectVersionForReplication",
          ],
          Resource: `${sourceBucketArn}/*`,
        },
        {
          Effect: "Allow",
          Action: [
            "s3:ReplicateObject",
            "s3:ReplicateDelete",
            "s3:ReplicateTags",
          ],
          Resource: arns.map((arn) => `${arn}/*`),
        },
      ],
    });
  }
}
