import { Stack } from "aws-cdk-lib";
import { Key } from "aws-cdk-lib/aws-kms";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class StateManagement extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const { region, account } = Stack.of(this);

    new Bucket(this, "StateBucket", {
      bucketName: `state-bucket-${region}-${account}`,
      encryption: BucketEncryption.KMS_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    new Key(this, "StateKey", {
      alias: "StateKey",
      enableKeyRotation: true,
    });
  }
}
