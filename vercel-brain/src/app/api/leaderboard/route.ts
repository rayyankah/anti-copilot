import { NextResponse } from 'next/server';
import { dynamoDb } from '@/lib/aws/dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

export async function GET() {
  try {
    // Scan for user error aggregates
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
        // In production, use a GSI for efficient leaderboard queries
      })
    );

    // TODO: Aggregate and rank users by error frequency
    const leaderboard = result.Items || [];

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('[Leaderboard API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
