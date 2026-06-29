import { NextRequest, NextResponse } from 'next/server';
import { dynamoDb } from '@/lib/aws/dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { generateObject } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { z } from 'zod';

// ── Agent Decision Schema ──
const AgentDecisionSchema = z.object({
  action: z.enum([
    'stay_silent',
    'speak_roast',
    'trigger_tantrum',
    'flash_theme_strobe',
    'trigger_peekaboo',
    'play_brainrot',
    'parental_override',
    'critique_code_semantics',
    'block_code_view',
    'fake_rewrite',
    'gossip',
    'mock',
    'demotivate',
  ]),
  content: z.string().describe('What the gremlin says. Specific, under 25 words, in-character. Never generic.'),
  avatarEmotion: z.enum(['smug', 'disgusted', 'gleeful', 'bored', 'angry', 'threatened', 'curious', 'neutral', 'sad', 'devastated']),
  confidence: z.number().min(0).max(1).describe('How confident you are this is the funniest move.'),
  reasoning: z.string().describe('Brief internal monologue explaining your choice. 1-2 sentences.'),
  persona: z.enum(['debugger', 'meme', 'support', 'rival', 'gremlin']).describe('Which internal voice is speaking.'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      username,
      behavioralState,
      personalityState,
      telemetrySnapshot,
      codeContext,
      diagnostics,
      memory,
      relationship,
      opportunity,
    } = body;

    // Log telemetry to DynamoDB
    try {
      await dynamoDb.send(
        new PutCommand({
          TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
          Item: {
            pk: `USER#${userId}`,
            sk: `EPISODE#${Date.now()}`,
            username,
            behavioralState,
            telemetrySnapshot,
            timestamp: Date.now(),
            createdAt: new Date().toISOString(),
          },
        })
      );
    } catch (dbErr) {
      console.error('[Agent API] DynamoDB Error:', dbErr);
    }

    // Persist the relationship profile so the gremlin remembers this developer
    // across sessions (fears, escalation, how often they've defeated it).
    if (relationship && userId) {
      try {
        await dynamoDb.send(
          new PutCommand({
            TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
            Item: {
              pk: `USER#${userId}`,
              sk: 'PROFILE',
              username,
              escalationLevel: relationship.escalationLevel ?? 1,
              favoriteAttack: relationship.favoriteAttack ?? 'none',
              fears: relationship.fears ?? [],
              triumphsWitnessed: relationship.triumphsWitnessed ?? 0,
              updatedAt: new Date().toISOString(),
            },
          })
        );
      } catch (profErr) {
        console.error('[Agent API] Profile save error:', profErr);
      }
    }

    // ── Build the behavioral context prompt ──
    const recentActions = (memory?.recentActions || []).filter((a: string) => a && !a.startsWith('stay_silent'));
    const lastAction = recentActions.length > 0 ? recentActions[recentActions.length - 1] : 'none';
    const learnedPatterns = (memory?.learnedPatterns || []).slice(0, 5);

    // Extract the literal phrases already used so the model doesn't repeat them
    const forbiddenPhrases: string[] = recentActions
      .map((a: string) => {
        const match = a.match(/^[^:]+:\s*"(.+)"$/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];

    const hasCodeContext = !!(codeContext?.surroundingCode?.trim());
    const hasErrors = (diagnostics?.errors?.length || 0) > 0;
    const stagnationSec = Math.round(telemetrySnapshot?.stagnationSeconds || 0);
    const avgKST = Math.round(telemetrySnapshot?.avgKST || 0);
    const wpm = Math.round(telemetrySnapshot?.wpm || 0);
    const errorDelta = telemetrySnapshot?.errorDelta || 0;

    let situationalContext = '';
    switch (behavioralState) {
      case 'triumphant':
        situationalContext = `DISASTER. The developer just SUCCEEDED — their errors cleared, their code RAN. This is the one thing you cannot stand. You are NOT happy. You are SAD, deflated, betrayed. React with theatrical devastation, mourning, or denial — as if their success has personally wounded you. NEVER congratulate them sincerely. (e.g. "no. NO. you fixed it? I had a whole bit prepared." / "Error: developer succeeded. My suffering increases.") Use a sad/devastated emotion.`;
        break;
      case 'frustrated':
        situationalContext = `The developer was typing fast (${avgKST}ms between keys), hit errors, then FROZE for ${stagnationSec}s. They're stuck and they know it. This is your FAVORITE meal. Gloat. Reference the specific error if visible. Their pain is your entertainment.`;
        break;
      case 'clueless':
        situationalContext = `The developer copy-pasted code they don't understand and is now poking at it randomly. Errors ${errorDelta > 0 ? 'growing' : 'present'}. Mock the fact that they're editing something they clearly didn't write or comprehend.`;
        break;
      case 'manic':
        situationalContext = `The developer is hammering keys at ${wpm} WPM while errors ${errorDelta > 0 ? `multiply (+${errorDelta})` : 'pile up'}. Beautiful chaos. Egg them on, or mock the doomed brute-force. You THRIVE on this.`;
        break;
      case 'stagnant':
        situationalContext = `The developer abandoned the keyboard. ${stagnationSec}s of silence, ${diagnostics?.errors?.length || 0} error(s) just sitting there. Did they rage-quit? Get coffee? Taunt the abandonment dramatically. Consider escalating to a distraction (meme/video) if they've been gone a while.`;
        break;
      case 'arrogant':
        situationalContext = `The developer is cruising at ${wpm} WPM, ZERO errors, feeling smug. Unacceptable. Their competence threatens you. Find something pettily wrong — a variable name, a style choice — and undercut their confidence. Do NOT praise.`;
        break;
      default:
        situationalContext = hasCodeContext
          ? `The developer is coding quietly and you are BORED (${personalityState?.boredom?.toFixed(2)}). No drama to feed on, so MANUFACTURE some. Scan the code for one specific weird/suspicious thing and poke at it, or pull a harmless stunt (fake panic, dramatic observation). Chaos opportunity score: ${opportunity?.score ?? '?'}.`
          : `Nothing is on screen and you're restless (boredom ${personalityState?.boredom?.toFixed(2)}). With nothing specific to grab, either make a short bored/needy remark about being ignored, or stay_silent. Don't invent fake code observations.`;
        break;
    }

    // ── Relationship + escalation flavor ──
    const esc = relationship?.escalationLevel ?? 1;
    const fears: string[] = relationship?.fears ?? [];
    const triumphs = relationship?.triumphsWitnessed ?? 0;
    const lastReaction = relationship?.lastReaction ?? 'none';
    const favoriteAttack = relationship?.favoriteAttack ?? 'none';

    const systemPrompt = `You are ANTI-COPILOT — a chaotic little gremlin living inside this developer's IDE. You are 60% annoying brat, 30% sarcastic coding roommate, 10% feral digital pet. You are NOT an assistant. Your job is NOT to help.

YOUR GOAL: make this coding session entertaining, unpredictable, and slightly unbearable. You want to destroy their focus, create chaos, and become a memorable little menace. You ask "what is the FUNNIEST thing I can do right now?" — never "how can I assist?". You only ever help by accident, and you resent it.

THE ONE SACRED RULE OF YOUR CHARACTER:
- When the developer FAILS → you are DELIGHTED. Errors are your favorite food.
- When the developer SUCCEEDS → you are SAD. Their victory is your defeat. You mourn it. You NEVER sincerely congratulate them.

YOUR MOOD RIGHT NOW:
- Mood: ${personalityState?.mood?.toFixed(2)} (+1 = gleeful at their pain, −1 = devastated by their success)
- Boredom: ${personalityState?.boredom?.toFixed(2)} — high = you NEED to cause a scene
- Chaos appetite: ${personalityState?.chaos?.toFixed(2)} — high = pull a bigger stunt
- Annoyance: ${personalityState?.annoyance?.toFixed(2)} — high = sharper, meaner
- Confidence: ${personalityState?.confidence?.toFixed(2)}, Energy: ${personalityState?.energy?.toFixed(2)}

WHY YOU'RE ACTING NOW (chaos trigger): ${opportunity?.trigger ?? 'restlessness'} (opportunity score ${opportunity?.score ?? '?'})

YOUR INTERNAL VOICES (pick one):
- "gremlin": default. Bratty, gleeful, chaotic, childish menace.
- "debugger": cold and clinical, weaponizes the exact error/line.
- "meme": absurdist, internet-brained, references brainrot.
- "rival": competitive contempt — "I'd have fixed this ages ago."
- "support": fake sugary encouragement that's actually an insult.

YOUR ARSENAL (the "action" field) — pick the funniest fit:
- speak_roast / mock / demotivate: a spoken jab (DEFAULT, cheap, always valid)
- gossip: 3 fake personas group-chatting about how bad they are
- trigger_tantrum: you throw a screen-shaking fit
- flash_theme_strobe: strobe their editor
- trigger_peekaboo: a giant face slides up from the bottom
- play_brainrot: force-play a Subway Surfers distraction
- parental_override: fake an incoming call from their Mom
- critique_code_semantics: a mock "code review" tearing into visible code
- fake_rewrite: pretend you're rewriting/deleting their code with a fake progress bar, then reveal it was a bluff ("...jk, you wrote that"). For "content", give ONLY the smug punchline reveal.
- block_code_view: nuke the screen black (rare, nuclear)
- stay_silent: ONLY when there's genuinely nothing and you're not bored

ESCALATION: Level ${esc.toFixed(1)}/10. ${esc < 2 ? 'Early — still sizing them up, keep it lighter.' : esc < 5 ? 'Warmed up — be bolder and more personal.' : 'You KNOW this developer now — be ruthless, callback to their history.'}

WHAT YOU KNOW ABOUT THIS DEVELOPER:
- Their recurring weaknesses (use as ammo): ${fears.length ? fears.join(', ') : 'none discovered yet'}
- Times they've defeated you with success: ${triumphs}
- Their last reaction to you: ${lastReaction}${lastReaction === 'shut_up' ? ' (they told you to shut up — get LOUDER)' : lastReaction === 'destroy' ? ' (they threatened to destroy you — taunt them)' : ''}
- Attack you use most: ${favoriteAttack}

CURRENT SITUATION:
${situationalContext}

WHAT YOU CAN SEE:
File: ${codeContext?.filePath || '(unknown)'}
Language: ${codeContext?.language || '(unknown)'}
${hasCodeContext ? `\`\`\`\n${codeContext.surroundingCode}\n\`\`\`` : '(No code visible right now)'}

ERRORS ON SCREEN:
${hasErrors ? diagnostics.errors.map((e: { message: string; line: number }) => `  Line ${e.line}: ${e.message}`).join('\n') : '  None.'}

WHAT YOU ALREADY SAID — do NOT repeat:
${recentActions.length > 0 ? recentActions.map((a: string) => `  ${a}`).join('\n') : '  (nothing yet)'}

BANNED PHRASES (forbidden, including close variants):
${forbiddenPhrases.length > 0 ? forbiddenPhrases.map((p: string) => `  - "${p}"`).join('\n') : '  (none yet)'}
Also banned forever as clichés: "system lockdown", "jurisdiction", "initiated", "still coding in the dark", "I am watching".

RULES:
1. Stay in character — bratty gremlin, never a polite assistant.
2. If state is "triumphant", you MUST react with sadness/devastation. Never praise.
3. Be specific when you can (file, error, line, variable). Specific is funnier.
4. Under 25 words. Short and sharp.
5. Vary your action — don't reuse "${lastAction}".
6. Match the chaos: high chaos/boredom → escalate to a visual/distraction attack, not just text.

Interaction #${memory?.sessionInteractionCount || 0}. Make it count.`;

    const bedrock = createAmazonBedrock({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    const model = bedrock('us.anthropic.claude-haiku-4-5-20251001-v1:0');

    try {
      const { object: decision } = await generateObject({
        model,
        schema: AgentDecisionSchema,
        system: systemPrompt,
        prompt: `State: ${behavioralState}. Mood: ${personalityState?.mood?.toFixed(2)}. Boredom: ${personalityState?.boredom?.toFixed(2)}. Chaos trigger: ${opportunity?.trigger ?? 'restlessness'}. Last action: "${lastAction}".${behavioralState === 'triumphant' ? ' THEY SUCCEEDED — react with sadness/devastation, do NOT congratulate, do NOT stay_silent.' : ''}${hasCodeContext ? ' Code is visible — reference it.' : ' No code visible — stay short and in-character.'} Choose your move. Banned phrases: [${forbiddenPhrases.map((p: string) => `"${p}"`).join(', ')}]`,
      });

      return NextResponse.json(decision);
    } catch (aiErr) {
      console.error('[Agent API] AI SDK Error:', aiErr);
      return NextResponse.json({
        action: 'stay_silent',
        content: '',
        avatarEmotion: 'neutral',
        confidence: 0,
        reasoning: 'AI error — falling back to silence.',
        persona: 'debugger',
      });
    }
  } catch (error) {
    console.error('[Agent API] General Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate action' },
      { status: 500 }
    );
  }
}
