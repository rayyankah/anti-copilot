import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { getAwsCredentials, getAwsRegion } from './credentials';

export const bedrockClient = new BedrockRuntimeClient({
  region: getAwsRegion(),
  credentials: getAwsCredentials(),
});
