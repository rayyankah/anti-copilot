import { NextResponse } from 'next/server';
import { dynamoDb } from '@/lib/aws/dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

export async function GET() {
  try {
    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
      })
    );

    const items = result.Items || [];
    
    // Aggregate by userId/username
    const userStats: Record<string, { username: string, totalErrors: number, triggerCounts: Record<string, number> }> = {};

    for (const item of items) {
      const userId = item.pk.replace('USER#', '');
      const username = item.username || 'Unknown Developer';
      const trigger = item.trigger || 'unknown';

      if (!userStats[userId]) {
        userStats[userId] = { username, totalErrors: 0, triggerCounts: {} };
      }

      userStats[userId].totalErrors++;
      userStats[userId].triggerCounts[trigger] = (userStats[userId].triggerCounts[trigger] || 0) + 1;
    }

    // Convert to LeaderboardEntry array
    const leaderboard = Object.entries(userStats).map(([userId, stats]) => {
      // Find top error
      let topError = 'none';
      let topErrorCount = 0;
      for (const [trigger, count] of Object.entries(stats.triggerCounts)) {
        if (count > topErrorCount) {
          topError = trigger;
          topErrorCount = count;
        }
      }

      return {
        userId,
        displayName: stats.username,
        totalErrors: stats.totalErrors,
        topError,
        topErrorCount,
        shameScore: stats.totalErrors * 10, // Arbitrary shame multiplier
      };
    });

    // Sort by shameScore descending
    leaderboard.sort((a, b) => b.shameScore - a.shameScore);

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('[Leaderboard API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
