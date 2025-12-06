import { App, RemovalPolicy } from "aws-cdk-lib";
import { BaseStack, BaseStackProps } from "./base-stack";
import {
  FeaturePlan,
  ManagedLoginVersion,
  Mfa,
  OAuthScope,
  UserPool,
} from "aws-cdk-lib/aws-cognito";
import { DomainNames, SSMParameters } from "@ns2-arena/common";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { SSMParameterReader } from "../features/ssm-parameter-management/ssm-parameter-reader";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { UserPoolDomainTarget } from "aws-cdk-lib/aws-route53-targets";
import { SSMParameterWriter } from "../features/ssm-parameter-management/ssm-parameter-writer";

export class CognitoStack extends BaseStack {
  constructor(scope: App, id: string, props: BaseStackProps) {
    super(scope, id, props);

    const zoneId = SSMParameterReader.readStringParameter(this, "ZoneId", {
      parameterName: SSMParameters.HostedZones.NS2Arena.Id,
    });
    const hostedZone = HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      hostedZoneId: zoneId,
      zoneName: DomainNames.getDomainName(props.environment),
    });

    const prod = props.environment === "prod";
    const pool = new UserPool(this, "UserPool", {
      mfa: Mfa.REQUIRED,
      mfaSecondFactor: {
        sms: false,
        otp: true,
        email: false,
      },
      standardAttributes: {
        email: {
          required: true,
        },
      },
      deletionProtection: prod,
      selfSignUpEnabled: prod,
      removalPolicy: prod ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      signInAliases: {
        username: true,
        email: true,
      },
      featurePlan: FeaturePlan.ESSENTIALS,
    });

    const redirectUri = "https://".concat(
      DomainNames.getDomainName(props.environment)
    );

    const client = pool.addClient("UserPoolClient", {
      oAuth: {
        callbackUrls: [redirectUri],
        defaultRedirectUri: redirectUri,
        logoutUrls: [redirectUri],
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
      },
    });

    const customDomainName = DomainNames.getDomainName(
      props.environment,
      "auth"
    );

    const certificateArn = SSMParameterReader.readStringParameter(
      this,
      "CertificateArn",
      {
        parameterName: SSMParameters.Certificates.Auth.Arn,
        region: "us-east-1",
      }
    );
    const certificate = Certificate.fromCertificateArn(
      this,
      "Certificate",
      certificateArn
    );

    const domain = pool.addDomain("UserPoolDomain", {
      customDomain: {
        domainName: customDomainName,
        certificate,
      },
      managedLoginVersion: ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    // Temporary until UI is setup
    const dummyRecord = new ARecord(this, "DummyDomainRecord", {
      zone: hostedZone,
      target: RecordTarget.fromIpAddresses("198.51.100.1"),
    });

    domain.node.addDependency(dummyRecord);

    new ARecord(this, "DomainRecord", {
      zone: hostedZone,
      target: RecordTarget.fromAlias(new UserPoolDomainTarget(domain)),
      recordName: "auth",
    });

    new AwsCustomResource(this, "CreateBrandingStyle", {
      onUpdate: {
        service: "@aws-sdk/client-cognito-identity-provider",
        action: "createManagedLoginBranding",
        parameters: {
          UserPoolId: pool.userPoolId,
          ClientId: client.userPoolClientId,
          UseCognitoProvidedValues: true,
        },
        physicalResourceId: PhysicalResourceId.of(
          "CognitoBranding-" + client.userPoolClientId
        ),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    SSMParameterWriter.writeStringParameter(this, "UserPoolArn", {
      parameterName: SSMParameters.UserPool.Arn,
      stringValue: pool.userPoolArn,
    });
  }
}
