import { NextResponse } from 'next/server';

/**
 * POST /api/contribute
 * Contributor signups closed when SteadyTrack was archived. Nobody reads the
 * archive database, so the route refuses submissions instead of collecting
 * names and emails it would silently drop.
 */
export function POST() {
  return NextResponse.json(
    { error: 'SteadyTrack is archived and no longer accepts contributor signups.' },
    { status: 410 }
  );
}
