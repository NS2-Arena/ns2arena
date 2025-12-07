import { Construct } from "constructs";
import { BaseStack, BaseStackProps } from "./base-stack";
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  EndpointType,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { SSMParameterReader } from "../features/ssm-parameter-management/ssm-parameter-reader";
import { DomainNames, SSMParameters, SubDomains } from "@ns2arena/common";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { ServersApi } from "../features/api/servers/servers-api";
import { ApiGatewayDomain } from "aws-cdk-lib/aws-route53-targets";
import { RegionInfo } from "../../bin/variables";
import { UserPool } from "aws-cdk-lib/aws-cognito";

interface RestApiStackProps extends BaseStackProps {
  computeRegions: RegionInfo[];
}

export class RestApiStack extends BaseStack {
  constructor(scope: Construct, id: string, props: RestApiStackProps) {
    super(scope, id, props);

    const { computeRegions } = props;

    const domainName = DomainNames.getDomainName(props.environment, SubDomains.Api);

    const hostedZoneId = SSMParameterReader.readStringParameter(
      this,
      "HostedZoneId",
      {
        parameterName: SSMParameters.HostedZones.NS2Arena.Id,
      }
    );

    const hostedZone = HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      hostedZoneId,
      zoneName: DomainNames.getDomainName(props.environment),
    });

    const userPoolArn = SSMParameterReader.readStringParameter(
      this,
      "UserPoolArn",
      {
        parameterName: SSMParameters.UserPool.Arn,
      }
    );
    const userPool = UserPool.fromUserPoolArn(this, "UserPool", userPoolArn);

    const certificate = new Certificate(this, "APICertificate", {
      domainName,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const api = new RestApi(this, "RestApi", {
      disableExecuteApiEndpoint: true,
      endpointTypes: [EndpointType.REGIONAL],
      defaultMethodOptions: {
        authorizationType: AuthorizationType.COGNITO,
        authorizer: new CognitoUserPoolsAuthorizer(this, "Authorizer", {
          cognitoUserPools: [userPool],
        }),
      },
    });

    const apiDomainName = api.addDomainName("CustomDomainName", {
      domainName,
      certificate,
    });

    new ARecord(this, "ARecord", {
      zone: hostedZone,
      target: RecordTarget.fromAlias(new ApiGatewayDomain(apiDomainName)),
      recordName: "api",
    });

    new ServersApi(this, "ServersApi", { api, computeRegions });
  }
}
