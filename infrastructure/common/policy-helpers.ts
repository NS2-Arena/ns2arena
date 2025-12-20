import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

type Statement =
  pulumi.Input<aws.types.input.iam.GetPolicyDocumentStatementArgs>;

export class Role {
  public static servicePrincipal(service: string): pulumi.Output<string> {
    return aws.iam.getPolicyDocumentOutput({
      statements: [
        {
          actions: ["sts:AssumeRole"],
          principals: [{ type: "Service", identifiers: [service] }],
        },
      ],
    }).json;
  }
}

export class Bucket {
  public static grantRead(bucket: aws.s3.Bucket): Statement {
    return {
      actions: ["s3:GetBucket*", "s3:GetObject*", "s3:List*"],
      effect: "Allow",
      resources: bucket.arn.apply((arn) => [arn, `${arn}/*`]),
    };
  }
}

export class Parameter {
  public static grantRead(parameter: aws.ssm.Parameter): Statement {
    return {
      actions: [
        "ssm:DecsribeParameters",
        "ssm:GetParameter",
        "ssm:GetParameterHistory",
        "ssm:GetParameters",
      ],
      effect: "Allow",
      resources: [parameter.arn.apply((a) => a)],
    };
  }
}

export class StateMachine {
  public static grantSendTaskNotification(
    stateMachine?: aws.sfn.StateMachine
  ): Statement {
    return {
      effect: "Allow",
      actions: [
        "states:SendTaskFailure",
        "states:SendTaskHeartbeat",
        "states:SendTaskSuccess",
      ],
      resources: ["*"],
    };
  }
}
