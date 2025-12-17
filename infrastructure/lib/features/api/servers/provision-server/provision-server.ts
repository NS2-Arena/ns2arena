import { Construct } from "constructs";
import { BaseLambdaFunction } from "../../../base-lambda/base-lambda";
import { StateMachine } from "aws-cdk-lib/aws-stepfunctions";
import { SSMParameterReader } from "../../../ssm-parameter-management/ssm-parameter-reader";
import { SSMParameters } from "@ns2arena/common";
import { RegionInfo } from "../../../../../bin/variables";

interface ProvisionServerProps {
  computeRegions: RegionInfo[];
}

export class ProvisionServer extends BaseLambdaFunction {
  constructor(scope: Construct, id: string, props: ProvisionServerProps) {
    super(scope, id, {
      entry: `${__dirname}/src/index.ts`,
    });

    const { computeRegions } = props;

    computeRegions.forEach((region) => {
      const arn = SSMParameterReader.readStringParameter(
        this,
        `StateMachineArn${region.value}`,
        {
          parameterName: SSMParameters.StateMachines.ServerManagement.Arn,
          region: region.value,
        }
      );
      const provisionServerStateMachine = StateMachine.fromStateMachineArn(
        this,
        `StateMachine${region.value}`,
        arn
      );

      provisionServerStateMachine.grantStartExecution(this.function);
      this.function.addEnvironment(
        `StateMachineArn${region.value.replaceAll("-", "")}`,
        arn
      );
    });
  }
}
