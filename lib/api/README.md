# API Helpers

`lib/api/` contains small helpers used by route handlers.

## Files

- `route-helpers.ts` - local API wrapper, simple rate-limit presets, and shared error handling
- `index.ts` - export surface for helper imports

The public archive has no authentication requirement. Route handlers should use local content adapters and browser-owned study state rather than authenticated user storage.

## Pattern

```ts
import { withApiRateLimit, RateLimitPresets } from "@/lib/api/route-helpers";

export const GET = withApiRateLimit(
  RateLimitPresets.MODERATE,
  async (_request, { content }) => {
    const { data, error } = await content
      .from("content_microcards")
      .select("*")
      .eq("status", "active");

    if (error) throw error;
    return Response.json({ data });
  }
);
```

`content` resolves to the SQLite-backed content adapter from `lib/local-db/server.ts`.
