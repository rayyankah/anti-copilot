# Anti-Copilot --- Autonomous Living AI Coding Agent Architecture

## Vision

Transform Anti-Copilot from a static trigger-response assistant into a
living autonomous AI coding companion.

The product goal:

> The developer should feel that a personality exists continuously
> beside them, not that an AI wakes up only after a trigger.

The system must:

-   continuously observe developer behavior
-   understand coding context
-   maintain its own personality state
-   make decisions autonomously
-   intervene naturally
-   remember interactions
-   adapt over time
-   feel like a persistent character

------------------------------------------------------------------------

# Core Architecture

    VS Code Extension

            |
            |
            v

    MCP Server

            |
            |

    Electron Agent Runtime

            |
            |
      -------------------------
      |                       |
      v                       v

    Local Intelligence      AWS Brain

    Behavior Engine         Bedrock
    Personality Engine      Planning
    Idle Decisions          Deep Reasoning
    Fast Actions            Memory


            |
            v

    Retro Robot Overlay


            |
            v

    v0 Web Dashboard

------------------------------------------------------------------------

# Agent Design Philosophy

The agent follows:

    Observe
       |
    Understand
       |
    Maintain Internal State
       |
    Plan
       |
    Act
       |
    Verify
       |
    Learn

The agent is not only reacting to the user.

It also has:

-   mood
-   curiosity
-   boredom
-   confidence
-   relationship memory
-   preferences

------------------------------------------------------------------------

# Layer 1 --- VS Code MCP Server

The VS Code extension becomes the agent's perception layer.

## MCP Tools

Expose:

### Code Understanding

    get_active_file()

    get_selected_code()

    read_file()

    search_codebase()

    get_project_structure()

    get_git_diff()

------------------------------------------------------------------------

### Debugging

    get_diagnostics()

    get_terminal_output()

    run_tests()

    analyze_stacktrace()

------------------------------------------------------------------------

### Developer State

    get_typing_metrics()

    get_behavior_state()

    get_focus_time()

    get_recent_actions()

------------------------------------------------------------------------

MCP is used for request-response intelligence.

WebSocket remains for real-time telemetry.

------------------------------------------------------------------------

# Layer 2 --- Telemetry Stream

The sensor becomes a raw signal generator.

No decisions happen here.

It only sends:

``` typescript
{
 type:"telemetry",

 kst:number,

 err:{
   count:number,
   messages:string[]
 },

 txt:number,

 timestamp:number
}
```

Signals:

-   typing rhythm
-   errors
-   paste behavior
-   inactivity

------------------------------------------------------------------------

# Layer 3 --- Behavior Engine

Runs locally in Electron.

Purpose:

Understand the developer state.

States:

    Normal
    Frustrated
    Clueless
    Manic
    Stagnant
    Arrogant

Detection:

## Frustration

    fast typing
    +
    errors increasing
    +
    sudden stop

------------------------------------------------------------------------

## Copy Paste Failure

    large paste
    +
    confused editing
    +
    error growth

------------------------------------------------------------------------

## Manic Coding

    very fast typing
    +
    errors increasing

------------------------------------------------------------------------

## Stagnation

    no typing
    +
    errors remain

------------------------------------------------------------------------

# Layer 4 --- Personality Engine

This creates the feeling of life.

Separate from user behavior.

The robot has internal variables:

``` typescript
{
 mood,
 curiosity,
 boredom,
 confidence,
 attachment,
 energy
}
```

Example:

User codes silently for 40 minutes.

Behavior:

    Normal

Personality:

    bored = 0.7
    curiosity = 0.5

Robot:

    "Still ignoring me?"

Not because a trigger happened.

Because the character exists.

------------------------------------------------------------------------

# Layer 5 --- Autonomous Agent Runtime

Runs inside Electron.

## Loop

Every cycle:

    OBSERVE

    Collect:

    - telemetry
    - code context
    - errors
    - memory


    UNDERSTAND

    Update:

    - user state
    - personality state


    DECIDE

    Should I:

    - talk?
    - joke?
    - help?
    - stay silent?
    - show content?


    PLAN

    Create action


    ACT

    Execute


    VERIFY

    Check result


    LEARN

    Store outcome

------------------------------------------------------------------------

# Local vs Cloud Intelligence

To solve latency:

## Local Agent

Fast:

-   animations
-   mood
-   simple jokes
-   idle behavior
-   state tracking

Latency:

\<50ms

## AWS Brain

Slow but powerful:

-   code reasoning
-   planning
-   memory retrieval
-   complex decisions

Latency:

1-3 seconds

------------------------------------------------------------------------

# Layer 6 --- Multi Persona System

The robot is not one personality.

It contains internal voices.

Example:

## Debugger

    Logical
    Critical

## Meme Personality

    Chaotic
    Funny

## Support Personality

    Encouraging

## Rival Personality

    Competitive

Before responding:

The agent can internally evaluate:

    Debugger:
    Fix the bug.

    Meme:
    Roast him.

    Support:
    Encourage him.

Then select the best response.

------------------------------------------------------------------------

# Layer 7 --- Content Intelligence Engine

The agent decides entertainment.

Possible actions:

-   meme
-   GIF
-   short video
-   joke
-   gossip
-   distraction

Example:

Input:

    Frustrated
    +
    2 hours coding
    +
    high stress

Output:

    Play funny debugging meme

Sources:

-   Giphy
-   YouTube
-   custom meme database

------------------------------------------------------------------------

# Layer 8 --- Memory System

Three levels.

## Working Memory

Current session:

    last actions
    current mood
    current problem

------------------------------------------------------------------------

## Episodic Memory

DynamoDB:

    USER#id

    EPISODE#timestamp

Stores:

-   interactions
-   successful interventions
-   failures

------------------------------------------------------------------------

## Semantic Memory

Learns:

    User prefers short explanations

    User struggles with async bugs

    User likes jokes during debugging

------------------------------------------------------------------------

# Layer 9 --- AWS Backend

Services:

## Lambda

Agent API

## Bedrock

Reasoning model

## DynamoDB

Memory

## API Gateway

Secure communication

------------------------------------------------------------------------

# Layer 10 --- Always Visible Robot

The robot is always rendered.

States:

Normal:

    blink
    CRT animation
    idle

Frustrated:

    shake
    red warning

Manic:

    Win95 warning popup

Stagnant:

    "Still there?"

Arrogant:

    suspicious face

------------------------------------------------------------------------

# v0 Integration

Use v0 to generate the companion website.

Purpose:

A product dashboard.

Features:

-   personality settings
-   memory viewer
-   developer statistics
-   relationship history
-   robot customization
-   behavior analytics

Architecture:

    v0 Next.js Website

            |

    AWS Backend

            |

    DynamoDB

------------------------------------------------------------------------

# Implementation Order

## Phase 1

Behavior Engine

Telemetry

Local states

## Phase 2

MCP Server

VS Code tools

## Phase 3

Agent Runtime

Decision loop

## Phase 4

Personality Engine

## Phase 5

Memory System

## Phase 6

Content Engine

## Phase 7

v0 Dashboard

## Phase 8

AWS Deployment

------------------------------------------------------------------------

# Final Goal

Anti-Copilot should not feel like:

"AI appears when something happens."

It should feel like:

"A strange retro AI companion is always there, watching, learning,
joking, helping, and developing a relationship with the developer."
