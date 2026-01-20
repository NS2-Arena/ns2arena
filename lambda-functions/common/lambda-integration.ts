import { APIGatewayEvent, Context } from "aws-lambda";

export type LambdaHandler<T, U = APIGatewayEvent> = (
  event: U,
  context: Context,
) => Promise<T>;

export type HttpLambdaHandler<T> = LambdaHandler<{
  statusCode: number;
  body?: T;
}>;

export type APIGatewayProxyResponse = LambdaHandler<{
  statusCode: number;
  body: string;
}>;

export const httpHandler = <T>(
  callback: HttpLambdaHandler<T>,
): APIGatewayProxyResponse => {
  return async (event: APIGatewayEvent, context: Context) => {
    return callback(event, context)
      .then((response) => ({
        statusCode: response.statusCode,
        body: JSON.stringify(response.body),
      }))
      .catch(() => ({
        statusCode: 500,
        body: "Internal server error",
      }));
  };
};
