import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

type IamStatement = aws.types.input.iam.GetPolicyDocumentStatementArgs;

interface State {
  name: string;
  stateDefinition: Object;
  iamStatement?: IamStatement;
}

type Chain = { next: string } | { end: true };

interface RetryPolicy {
  ErrorEquals: string[];
  IntervalSeconds: number;
  MaxAttempts: number;
  BackoffRate: number;
}

type BaseStateArgs = {
  name: string;
  chain: Chain;
  retry?: boolean | RetryPolicy[];
  assign?: Map<string, string>;
};

export abstract class BaseState<T extends BaseStateArgs = BaseStateArgs> {
  public readonly state: State;

  constructor(args: T) {
    const { name, chain, assign, retry } = args;

    let chainKey: string, chainValue: string | true;
    if ("next" in chain) {
      chainKey = "Next";
      chainValue = chain.next;
    } else {
      chainKey = "End";
      chainValue = chain.end;
    }

    let retryPolicy: RetryPolicy[] | undefined = undefined;
    if (typeof retry === "boolean" || typeof retry === "undefined") {
      if (retry === true || retry === undefined) {
        retryPolicy = this.getDefaultRetryPolicy();
      }
    } else {
      retryPolicy = retry;
    }

    const stateDefinition = this.getDefinition(args);
    const iamStatement = this.getStatement(args);

    this.state = {
      name: name,
      stateDefinition: {
        ...stateDefinition,
        [chainKey]: chainValue,
        Assign: assign,
        Retry: retryPolicy,
      },
      iamStatement,
    };
  }

  protected abstract getDefinition(args: T): Object;
  protected abstract getStatement(args: T): IamStatement | undefined;
  protected abstract getDefaultRetryPolicy(): RetryPolicy[] | undefined;
}

export class PassState extends BaseState {
  protected getDefinition(args: BaseStateArgs): Object {
    return {
      Type: "Pass",
    };
  }

  protected getStatement(args: BaseStateArgs): IamStatement | undefined {
    return undefined;
  }

  protected getDefaultRetryPolicy(): RetryPolicy[] | undefined {
    return undefined;
  }
}

interface InvokeLambdaArgs extends BaseStateArgs {
  lambda: aws.lambda.Function;
  payload?: Object;
}

export class InvokeLambdaState extends BaseState<InvokeLambdaArgs> {
  protected getDefinition(args: InvokeLambdaArgs): Object {
    const { lambda, payload } = args;

    return {
      Type: "Task",
      Arguments: {
        FunctionName: lambda.name,
        Payload: payload,
      },
      Resource: "arn:aws:states:::lambda:invoke",
    };
  }

  protected getStatement(args: InvokeLambdaArgs): IamStatement | undefined {
    return {
      actions: ["lambda:InvokeFunction"],
      resources: [args.lambda.arn],
      effect: "Allow",
    };
  }

  protected getDefaultRetryPolicy(): RetryPolicy[] | undefined {
    return [
      {
        ErrorEquals: [
          "Lambda.ClientExecutionTimeoutException",
          "Lambda.ServiceException",
          "Lambda.AWSLambdaException",
          "Lambda.SdkClientException",
        ],
        IntervalSeconds: 2,
        MaxAttempts: 6,
        BackoffRate: 2,
      },
    ];
  }
}
