import { NextResponse } from 'next/server';

/**
 * Shared CORS headers so a separate browser frontend (the Commentator) can call
 * the brain from a different origin.
 *
 * Set ALLOWED_ORIGIN in the environment to lock this down to one site;
 * defaults to "*" for easy local/hackathon use.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/** Wrap any JSON payload in a NextResponse that carries the CORS headers. */
export function jsonWithCors(body: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(body, { status: init?.status ?? 200, headers: corsHeaders });
}

/** Standard preflight response. Re-export as `OPTIONS` from a route to enable it. */
export function preflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
