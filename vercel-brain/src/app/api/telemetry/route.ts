import { NextRequest, NextResponse } from 'next/server';
import { dynamoDb } from '@/lib/aws/dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, trigger, metadata, timestamp } = body;

    // Log telemetry to DynamoDB
    await dynamoDb.send(
      new PutCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
        Item: {
          pk: `USER#${userId}`,
          sk: `TRIGGER#${timestamp}`,
          trigger,
          metadata,
          timestamp,
          createdAt: new Date().toISOString(),
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Telemetry API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to log telemetry' },
      { status: 500 }
    );
  }
}
