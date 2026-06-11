# SteadyTrack Notification System

## Overview
A comprehensive Discord notification system that tracks user activity and engagement across SteadyTrack.

## What's Implemented

### Real-Time Notifications
The following events trigger immediate Discord notifications:

1. **🎉 New User Signup** (Green)
   - Triggers when a new user creates an account
   - Shows: Email, User ID, Signup timestamp

2. **📚 First Plan Created** (Blue)
   - Triggers when a user creates their first study plan
   - Shows: Subjects, duration, total units, start date

3. **🎓 Plan Completed** (Purple)
   - Triggers when a user completes their entire study plan
   - Shows: Subjects, total units, completion timestamp

4. **🔥 Streak Milestones** (Yellow/Orange/Red)
   - Triggers at 7, 30, and 100-day streaks
   - Shows: Current streak, longest streak, total study days

### Daily Digest (9 AM UTC)
Automated daily summary sent every morning with:
- New signups count
- Daily Active Users (DAU)
- Plans created
- Plans completed
- Total study sessions
- Active streaks count
- Popular subjects (top 5)
- Week-over-week trends

## Files Created

### Edge Functions
- `supabase/functions/notify-user-activity/index.ts` - Handles real-time notifications
- `supabase/functions/daily-digest/index.ts` - Generates daily activity summary

### Database Migrations
- `supabase/migrations/20251012000010_add_user_activity_webhooks.sql` - Database triggers for real-time events
- `supabase/migrations/20251012000011_add_daily_digest_cron.sql` - pg_cron schedule for daily digest

### Configuration
- `.env.local` - Added `DISCORD_WEBHOOK_URL`
- `.env.example` - Documented Discord webhook setup

## How It Works

### Real-Time Flow
1. User performs an action (signup, create plan, etc.)
2. Database trigger fires on the relevant table
3. Trigger calls Edge Function via `pg_net`
4. Edge Function formats the data and sends to Discord webhook
5. You receive a beautifully formatted Discord embed

### Daily Digest Flow
1. pg_cron runs at 9 AM UTC daily
2. Calls `trigger_daily_digest()` function
3. Function invokes daily-digest Edge Function
4. Edge Function queries database for yesterday's stats
5. Calculates trends and popular subjects
6. Sends formatted digest to Discord

## Testing

You can manually test notifications using curl:

### Test New Signup
```bash
curl -X POST "https://axylsabmkugtbkqsffpg.supabase.co/functions/v1/notify-user-activity" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "insert",
    "table": "users",
    "schema": "auth",
    "record": {
      "id": "test-123",
      "email": "test@example.com",
      "created_at": "2025-10-12T10:00:00Z"
    }
  }'
```

### Test Daily Digest
```bash
curl -X POST "https://axylsabmkugtbkqsffpg.supabase.co/functions/v1/daily-digest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Monitoring

### View Cron Jobs
```sql
SELECT * FROM cron.job;
```

### View Cron Job History
```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-digest')
ORDER BY start_time DESC
LIMIT 10;
```

### Check HTTP Request Status (pg_net)
```sql
SELECT * FROM net._http_response
ORDER BY created DESC
LIMIT 10;
```

## Customization

### Change Daily Digest Time
Edit the cron schedule in the migration:
```sql
-- Current: 9 AM UTC
SELECT cron.schedule('daily-digest', '0 9 * * *', $$SELECT trigger_daily_digest();$$);

-- Change to 6 PM UTC
SELECT cron.unschedule('daily-digest');
SELECT cron.schedule('daily-digest', '0 18 * * *', $$SELECT trigger_daily_digest();$$);
```

### Add More Notification Events
1. Create a new trigger function in a migration
2. Add the event handling logic to `notify-user-activity/index.ts`
3. Deploy the updated Edge Function
4. Apply the migration

### Use Multiple Discord Channels
Create different webhook URLs for different event types:
- Add `DISCORD_WEBHOOK_SIGNUPS`, `DISCORD_WEBHOOK_MILESTONES`, etc.
- Modify Edge Functions to use the appropriate webhook based on event type

## Troubleshooting

### Notifications Not Sending
1. Check Edge Function logs in Supabase Dashboard
2. Verify Discord webhook URL is correct
3. Check `net._http_response` table for failed requests
4. Ensure pg_net extension is enabled

### Daily Digest Not Running
1. Check if pg_cron extension is enabled
2. View cron job history (see Monitoring section)
3. Manually trigger the function to test
4. Check Edge Function logs for errors

## Security Notes

- Discord webhook URL is stored as an Edge Function secret
- Database triggers use `SECURITY DEFINER` for proper permissions
- Service role key never exposed to client
- All HTTP requests are async (won't block database operations)

## Future Enhancements

Consider adding:
- Email notifications (via Resend/SendGrid)
- SMS notifications (via Twilio)
- Slack integration
- Weekly summary reports
- User churn alerts (inactive for 7+ days)
- A/B test completion notifications
- Export to analytics platforms
