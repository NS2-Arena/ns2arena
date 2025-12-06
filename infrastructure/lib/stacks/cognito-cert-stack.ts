import { App } from "aws-cdk-lib";
import { BaseStack, BaseStackProps } from "./base-stack";
import { DomainNames, SSMParameters } from "@ns2-arena/common";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { SSMParameterReader } from "../features/ssm-parameter-management/ssm-parameter-reader";
import { SSMParameterWriter } from "../features/ssm-parameter-management/ssm-parameter-writer";

interface CognitoCertStackProps extends BaseStackProps {
  mainRegion: string;
}

export class CognitoCertStack extends BaseStack {
  constructor(scope: App, id: string, props: CognitoCertStackProps) {
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
    const hostedZone = HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      zoneName: DomainNames.getDomainName(props.environment),
      hostedZoneId,
    });

    const customDomainName = DomainNames.getDomainName(
      props.environment,
      "auth"
    );

    const certificate = new Certificate(this, "Certificate", {
      domainName: customDomainName,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    SSMParameterWriter.writeStringParameter(this, "CertificateArn", {
      parameterName: SSMParameters.Certificates.Auth.Arn,
      stringValue: certificate.certificateArn,
    });
  }
}
