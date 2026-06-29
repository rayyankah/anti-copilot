import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getAwsCredentials, getAwsRegion } from './credentials';

const client = new DynamoDBClient({
  region: getAwsRegion(),
  credentials: getAwsCredentials(),
});

export const dynamoDb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});
