import { NextRequest, NextResponse } from 'next/server';
import { dynamoDb } from '@/lib/aws/dynamodb';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ config: null });
  }

  try {
    const result = await dynamoDb.send(
      new GetCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
        Key: { pk: `USER#${userId}`, sk: 'CONFIG' },
      })
    );

    if (!result.Item) {
      return NextResponse.json({ config: null });
    }

    return NextResponse.json({
      config: {
        baseChaos: result.Item.baseChaos ?? 0.5,
        defaultMood: result.Item.defaultMood ?? 0.5,
        muteAttacks: result.Item.muteAttacks ?? false,
      },
    });
  } catch (err) {
    console.error('[Config API] Error fetching config:', err);
    return NextResponse.json({ config: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, config } = body;

    if (!userId || !config) {
      return NextResponse.json({ error: 'Missing userId or config' }, { status: 400 });
    }

    await dynamoDb.send(
      new PutCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
        Item: {
          pk: `USER#${userId}`,
          sk: 'CONFIG',
          baseChaos: config.baseChaos,
          defaultMood: config.defaultMood,
          muteAttacks: config.muteAttacks,
          updatedAt: Date.now(),
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Config API] Error saving config:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
