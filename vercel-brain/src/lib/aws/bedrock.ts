import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

export const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  // Credentials are automatically loaded from process.env.AWS_ACCESS_KEY_ID and process.env.AWS_SECRET_ACCESS_KEY
});
