# Fix: Navio API 400 Validation Error

## Status: ✅ Implemented

## Changes Made

1. **Edge Function (`supabase/functions/navio-import/index.ts`)**
   - Added `page_size=1000` and `page_index=0` query parameters to ensure paginated response format
   - Added `Accept: application/json` header
   - Improved error logging - now logs to sync_logs table on API error
   - Better response structure logging for debugging
   - Handles paginated response with `results` array correctly

2. **Progress Dialog (`src/components/sync/SyncProgressDialog.tsx`)**
   - Added error detection to close dialog after 3 seconds when error status is detected
   - Prevents infinite spinning on errors

## Next Steps
- Test the Navio Fetch & Preview button to verify the fix works
