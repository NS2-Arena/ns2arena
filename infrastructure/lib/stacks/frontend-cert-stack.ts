import { Construct } from "constructs";
import { BaseStack, BaseStackProps } from "./base-stack";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { DomainNames, SSMParameters } from "@ns2arena/common";
import { PublicHostedZone } from "aws-cdk-lib/aws-route53";
import { SSMParameterReader } from "../features/ssm-parameter-management/ssm-parameter-reader";
import { SSMParameterWriter } from "../features/ssm-parameter-management/ssm-parameter-writer";

interface FrontendCertStackProps extends BaseStackProps {
  mainRegion: string;
}

export class FrontendCertStack extends BaseStack {
  constructor(scope: Construct, id: string, props: FrontendCertStackProps) {
    super(scope, id, props);

    const { mainRegion } = props;

    const hostedZoneId = SSMParameterReader.readStringParameter(
      this,
      "HostedZoneId",
      {
        parameterName: SSMParameters.HostedZones.NS2Arena.Id,
        region: mainRegion,
      }
    );
    const hostedZone = PublicHostedZone.fromHostedZoneAttributes(
      this,
      "HostedZone",
      {
        zoneName: DomainNames.getDomainName(props.environment),
        hostedZoneId,
      }
    );

    const cert = new Certificate(this, "Certificate", {
      domainName: DomainNames.getDomainName(props.environment),
      validation: CertificateValidation.fromDns(hostedZone),
    });

    SSMParameterWriter.writeStringParameter(this, "CertificateArn", {
      stringValue: cert.certificateArn,
      parameterName: SSMParameters.Certificates.Root.Arn,
    });
  }
}
