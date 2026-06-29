/**
 * AWS credential resolver.
 *
 * Vercel RESERVES every environment variable that starts with `AWS_`
 * (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, ...), so the AWS SDK's
 * default credential chain cannot pick them up there. We therefore read from
 * app-prefixed names on Vercel and fall back to the standard AWS_* names for
 * local dev / SST so nothing breaks in either environment.
 */
export function getAwsRegion(): string {
  return (
    process.env.APP_AWS_REGION ||
    process.env.AWS_REGION ||
    'us-east-1'
  );
}

export function getAwsCredentials():
  | { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
  | undefined {
  const accessKeyId =
    process.env.APP_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.APP_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken =
    process.env.APP_AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    // Let the SDK fall back to its default chain (useful for SST/IAM roles).
    return undefined;
  }
  return { accessKeyId, secretAccessKey, sessionToken };
}
