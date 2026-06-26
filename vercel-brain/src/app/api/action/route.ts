import { NextRequest, NextResponse } from 'next/server';
import { dynamoDb } from '@/lib/aws/dynamodb';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { bedrockClient } from '@/lib/aws/bedrock';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, username, trigger, metadata, timestamp } = body;

    // Log telemetry to DynamoDB first
    try {
      await dynamoDb.send(
        new PutCommand({
          TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
          Item: {
            pk: `USER#${userId}`,
            sk: `TRIGGER#${timestamp || Date.now()}`,
            username,
            trigger,
            metadata,
            timestamp: timestamp || Date.now(),
            createdAt: new Date().toISOString(),
          },
        })
      );
    } catch (dbErr) {
      console.error('[Action API] DynamoDB Error:', dbErr);
      // Proceed even if telemetry fails
    }

    // Read historical error count from DynamoDB before calling Bedrock
    let historicalErrorCount = 0;
    try {
      const queryResult = await dynamoDb.send(
        new QueryCommand({
          TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': `USER#${userId}` },
          Select: 'COUNT',
        })
      );
      historicalErrorCount = queryResult.Count || 0;
    } catch (countErr) {
      console.error('[Action API] DynamoDB Count Error:', countErr);
    }

    // Prepare Bedrock prompt
    const prompt = `You are a comedy writer for "Anti-Copilot", a FUNNY and VOLUNTARY developer tool that roasts programmers with lighthearted jokes when they make mistakes. Think of it like a stand-up comedian doing a developer roast — the humor should be sharp but playful, never actually mean-spirited. The developer has voluntarily installed this for entertainment.

The developer (their chosen comedy stage name is "${username || 'the developer'}") just triggered: "${trigger}".
This developer has made ${historicalErrorCount} total mistakes so far. Use this count to make the roast funnier (e.g. "mistake #${historicalErrorCount}" or "your ${historicalErrorCount}th error today").
Context: ${JSON.stringify(metadata || {})}

Write a SHORT, FUNNY one-liner roast (max 2 sentences). Pick the most appropriate comedy style:
- mock: A witty observation about their coding habit.
- demotivate: A dramatically exaggerated "you should quit" joke (clearly over-the-top comedy).
- gossip: A funny line as if other developers are joking about them at the watercooler.
- send_meme: A punchy caption for a coding meme.
- block_window: A dramatic "access denied" joke (only for dirty_commit trigger).
- force_light_mode: A joke about switching to light mode as "punishment" (only for triple_error trigger).

Respond ONLY with valid JSON:
{
  "action": "one of the styles above",
  "content": "your funny roast here"
}`;

    let actionResponse = { action: 'mock', content: 'I am watching you fail.' };

    try {
      const command = new InvokeModelCommand({
        modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 200,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }]
        }),
      });

      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      let aiText = responseBody.content[0].text.trim();
      
      // Strip markdown code fences if present (Claude often wraps JSON in ```json ... ```)
      if (aiText.startsWith('```')) {
        aiText = aiText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
      }

      try {
        actionResponse = JSON.parse(aiText);
      } catch (parseErr) {
        console.error('Failed to parse AI response as JSON:', aiText);
      }
    } catch (aiErr) {
      console.error('[Action API] Bedrock Error:', aiErr);
      // Fallback to placeholder if AI fails (e.g. account pending verification)
      actionResponse = generatePlaceholderAction(trigger);
    }

    return NextResponse.json(actionResponse);
  } catch (error) {
    console.error('[Action API] General Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate action' },
      { status: 500 }
    );
  }
}

function generatePlaceholderAction(trigger: string) {
  const actions: Record<string, { action: string; content: string }> = {
    blank_space: {
      action: 'mock',
      content: 'Staring at an empty file won\'t make the code write itself... or will it? No. It won\'t.',
    },
    code: {
      action: 'demotivate',
      content: 'Wow, you\'re typing fast! Too bad speed doesn\'t fix the quality of your code.',
    },
    terminal_error: {
      action: 'mock',
      content: 'Another error? At this point, the compiler knows you by first name.',
    },
    pause: {
      action: 'demotivate',
      content: 'Taking a break from writing bugs? Smart move, but the damage is already done.',
    },
    large_paste: {
      action: 'gossip',
      content: 'CTRL+C, CTRL+V — the only two shortcuts you\'ve actually mastered.',
    },
    triple_error: {
      action: 'force_light_mode',
      content: 'Same error THREE times? Enjoy light mode as punishment.',
    },
    dirty_commit: {
      action: 'block_window',
      content: 'You\'re trying to commit with errors? I\'m not letting you embarrass yourself... publicly.',
    },
  };

  return actions[trigger] || { action: 'mock', content: 'I\'m watching you. Always.' };
}
