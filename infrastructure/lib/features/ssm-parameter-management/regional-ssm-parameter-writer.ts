import { Arn, Stack } from "aws-cdk-lib";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  AwsSdkCall,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

interface SSMParameterReaderProps {
  parameterName: string;
  stringValue: string;
  region: string;
}

function removeLeadingSlash(value: string): string {
  return value.slice(0, 1) == "/" ? value.slice(1) : value;
}

export class RegionalSSMParameterWriter extends AwsCustomResource {
  constructor(scope: Construct, id: string, props: SSMParameterReaderProps) {
    const { parameterName, stringValue, region } = props;

    const ssmAwsSdkCall: AwsSdkCall = {
      service: "SSM",
      action: "putParameter",
      parameters: {
        Name: parameterName,
        Value: stringValue,
        Type: "String",
        Overwrite: true,
      },
      region,
      physicalResourceId: PhysicalResourceId.of(Date.now().toString()),
    };

    const ssmCrPolicy = AwsCustomResourcePolicy.fromSdkCalls({
      resources: [
        Arn.format(
          {
            service: "ssm",
            region: props.region,
            resource: "parameter",
            resourceName: removeLeadingSlash(parameterName),
          },
          Stack.of(scope)
        ),
      ],
    });

    super(scope, id, { onUpdate: ssmAwsSdkCall, policy: ssmCrPolicy });
  }
}
