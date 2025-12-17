import { Construct } from "constructs";
import { BaseStack, BaseStackProps } from "./base-stack";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import * as path from "path";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import {
  AllowedMethods,
  Distribution,
  PriceClass,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { RemovalPolicy } from "aws-cdk-lib";
import { DomainNames, SSMParameters } from "@ns2arena/common";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { SSMParameterReader } from "../features/ssm-parameter-management/ssm-parameter-reader";

export class FrontendStack extends BaseStack {
  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);

    const certArn = SSMParameterReader.readStringParameter(
      this,
      "CertificateArn",
      {
        parameterName: SSMParameters.Certificates.Root.Arn,
        region: "us-east-1",
      }
    );
    const certificate = Certificate.fromCertificateArn(
      this,
      "Certificate",
      certArn
    );

    const bucket = new Bucket(this, "Bucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
    });

    const distribution = new Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
      },
      priceClass: PriceClass.PRICE_CLASS_100,
      domainNames: [DomainNames.getDomainName(props.environment)],
      certificate,
    });

    new BucketDeployment(this, "BucketDeployment", {
      destinationBucket: bucket,
      sources: [
        Source.asset(path.resolve(__dirname, "../../../frontend/dist")),
      ],
      distribution,
    });
  }
}
