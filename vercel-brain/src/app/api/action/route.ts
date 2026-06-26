import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trigger, metadata } = body;

    // TODO: Integrate LLM (e.g., AWS Bedrock or OpenAI) to generate response
    // For now, return a placeholder action
    const action = generatePlaceholderAction(trigger);

    return NextResponse.json(action);
  } catch (error) {
    console.error('[Action API] Error:', error);
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
