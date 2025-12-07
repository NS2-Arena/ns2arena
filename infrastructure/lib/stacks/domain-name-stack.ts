import { App } from "aws-cdk-lib";
import { BaseStack, BaseStackProps } from "./base-stack";
import { PublicHostedZone } from "aws-cdk-lib/aws-route53";
import { SSMParameterWriter } from "../features/ssm-parameter-management/ssm-parameter-writer";
import { DomainNames, SSMParameters } from "@ns2arena/common";

export class DomainNameStack extends BaseStack {
  constructor(scope: App, id: string, props: BaseStackProps) {
    super(scope, id, props);

    const hostedZone = new PublicHostedZone(this, "HostedZone", {
      zoneName: DomainNames.getDomainName(props.environment),
    });

    SSMParameterWriter.writeStringParameter(this, "HostedZoneId", {
      parameterName: SSMParameters.HostedZones.NS2Arena.Id,
      stringValue: hostedZone.hostedZoneId,
    });

    SSMParameterWriter.writeStringParameter(this, "HostedZoneArn", {
      parameterName: SSMParameters.HostedZones.NS2Arena.Arn,
      stringValue: hostedZone.hostedZoneArn,
    });
  }
}
