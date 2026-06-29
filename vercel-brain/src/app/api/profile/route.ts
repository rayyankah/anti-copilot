import { NextRequest, NextResponse } from 'next/server';
import { dynamoDb } from '@/lib/aws/dynamodb';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

/**
 * GET /api/profile?userId=...
 * Returns the gremlin's stored relationship profile for a developer, so it can
 * pick up where it left off across sessions. Returns nulls if none exists yet.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ profile: null });
  }

  try {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
        Key: { pk: `USER#${userId}`, sk: 'PROFILE' },
      })
    );

    if (!result.Item) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({
      profile: {
        escalationLevel: result.Item.escalationLevel ?? 1,
        favoriteAttack: result.Item.favoriteAttack ?? 'none',
        fears: result.Item.fears ?? [],
        triumphsWitnessed: result.Item.triumphsWitnessed ?? 0,
      },
    });
  } catch (err) {
    console.error('[Profile API] Error:', err);
    return NextResponse.json({ profile: null });
  }
}
