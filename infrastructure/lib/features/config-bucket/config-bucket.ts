import { RemovalPolicy, Stack } from "aws-cdk-lib";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  BucketProps,
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { SSMParameterWriter } from "../ssm-parameter-management/ssm-parameter-writer";
import { SSMParameters } from "@ns2arena/common";

export class ConfigBucket extends Bucket {
  constructor(scope: Construct, id: string, props?: BucketProps) {
    const stack = Stack.of(scope);

    super(scope, id, {
      bucketName: `ns2server-configs-${stack.account}-${stack.region}`,
      versioned: true,
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      enforceSSL: true,
      autoDeleteObjects: true,
      ...props,
    });

    SSMParameterWriter.writeStringParameter(this, "BucketArnParameter", {
      stringValue: this.bucketArn,
      parameterName: SSMParameters.ConfigBucket.Arn,
    });

    SSMParameterWriter.writeStringParameter(this, "BucketNameParameter", {
      stringValue: this.bucketName,
      parameterName: SSMParameters.ConfigBucket.Name,
    });
  }
}
