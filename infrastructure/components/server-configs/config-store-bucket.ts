import * as common from "../../common";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface ConfigStoreBucketArgs {
  region?: string;
}

export class ConfigStoreBucket extends pulumi.ComponentResource {
  public readonly bucket: aws.s3.Bucket;
  public readonly parameter: aws.ssm.Parameter;

  constructor(
    name: string,
    args: ConfigStoreBucketArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("ns2arena:server-configs:ConfigBucket", name, args, opts);

    const region = args.region ?? aws.getRegionOutput({}).region;
    const accountId = aws.getCallerIdentityOutput().accountId;

    this.bucket = new aws.s3.Bucket(
      `${name}-bucket`,
      {
        bucket: pulumi
          .all([accountId, region])
          .apply(
            ([accountId, region]) => `ns2server-configs-${accountId}-${region}`,
          ),
        forceDestroy: true,
      },
      { parent: this },
    );

    new aws.s3.BucketVersioning(
      `${name}-versioning`,
      {
        bucket: this.bucket.id,
        versioningConfiguration: {
          status: "Enabled",
        },
      },
      { parent: this, dependsOn: this.bucket },
    );

    new aws.s3.BucketPublicAccessBlock(
      `${name}-block-public-access`,
      {
        bucket: this.bucket.id,
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      },
      { parent: this, dependsOn: this.bucket },
    );

    // Enforce SSL via bucket policy
    new aws.s3.BucketPolicy(
      `${name}-bucket-policy`,
      {
        bucket: this.bucket.id,
        policy: this.bucket.arn.apply((arn) =>
          JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Deny",
                Principal: "*",
                Action: "s3:*",
                Resource: [arn, `${arn}/*`],
                Condition: {
                  Bool: { "aws:SecureTransport": "false" },
                },
              },
            ],
          }),
        ),
      },
      { parent: this, dependsOn: this.bucket },
    );

    this.parameter = new aws.ssm.Parameter(
      `${name}-parameter`,
      {
        name: common.ssm.ConfigBucket.Arn,
        value: this.bucket.arn,
        type: aws.ssm.ParameterType.String,
      },
      { parent: this },
    );

    this.registerOutputs({
      bucketArn: this.bucket.arn,
      bucketName: this.bucket.bucket,
    });
  }
}
