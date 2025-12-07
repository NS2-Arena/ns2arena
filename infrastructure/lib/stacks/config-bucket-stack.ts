import { Construct } from "constructs";
import { BaseStack, BaseStackProps } from "./base-stack";
import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { ConfigBucket } from "../features/config-bucket/config-bucket";
import { RegionInfo } from "../../bin/variables";
import { SSMParameterReader } from "../features/ssm-parameter-management/ssm-parameter-reader";
import { SSMParameters } from "@ns2arena/common";

interface SourceConfigBucketStackProps extends BaseStackProps {
  mainRegion: string;
  replicationRegions: RegionInfo[];
}

export class ConfigBucketStack extends BaseStack {
  constructor(
    scope: Construct,
    id: string,
    props: SourceConfigBucketStackProps
  ) {
    super(scope, id, props);

    const { mainRegion, replicationRegions } = props;

    if (replicationRegions.length === 0 || mainRegion !== this.region) {
      new ConfigBucket(this, "ConfigBucket");
      return;
    }

    const destinationBuckets: IBucket[] = replicationRegions.map((region) => {
      const arn = SSMParameterReader.readStringParameter(
        this,
        `DestinationBucketParameter${region.alias}`,
        {
          parameterName: SSMParameters.ConfigBucket.Arn,
          region: region.value,
        }
      );

      return Bucket.fromBucketArn(
        this,
        `DestinationBucket${region.alias}`,
        arn
      );
    });

    const replicationRole = new Role(this, "ReplicationRole", {
      assumedBy: new ServicePrincipal("s3.amazonaws.com"),
    });

    const sourceBucket = new ConfigBucket(this, "ConfigBucket", {
      replicationRole,
      replicationRules: destinationBuckets.map((bucket) => ({
        destination: bucket,
        priority: 0,
        deleteMarkerReplication: true,
      })),
    });

    sourceBucket.grantReplicationPermission(replicationRole, {
      destinations: destinationBuckets.map((bucket) => ({ bucket })),
    });
  }
}
