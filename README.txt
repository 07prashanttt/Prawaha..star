PRAWAHA STAR — FULL STARTER (PWA + SUPABASE AUTH + VIDEO FEED)

WHAT IS INCLUDED
- Splash screen: BUILD BY PRASHANT YADAV
- Email/password signup, login, reset-password
- Google OAuth login
- Mobile OTP login (requires an SMS provider configured in Supabase)
- Video feed with auto-play when mostly visible, likes, comments, follows, share, report
- Video upload to Supabase Storage
- Profile, search, About page, PWA manifest/service worker

IMPORTANT LIMITS
This is a functional starter, not a production-ready TikTok-scale service.
The app uses a public video bucket so feed playback URLs work. Anyone with a video URL may view it.
There is no direct messaging, no automated content moderation, no admin moderation dashboard,
no block feature, no recommendation algorithm, and no secure server-side support form yet.
Do not launch publicly until moderation, age/privacy protections, takedown process, rate limits,
storage cost controls, and legal/privacy review are added.
Never put a Supabase service_role key in config.js. Only use the project's anon/publishable key.
Because the owner is a teen, involve a parent/guardian before publishing a public social platform,
collecting phone numbers, or making contact details public.

STEP 1 — CREATE SUPABASE PROJECT
1. Open https://supabase.com and create an account/project (with a parent/guardian if needed).
2. In Project Settings > API, copy Project URL and anon/publishable key.
3. Open config.js and replace:
   https://YOUR-PROJECT-REF.supabase.co
   YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
4. Never copy the service_role/secret key into the website.

STEP 2 — CREATE DATABASE + VIDEO STORAGE
1. Open Supabase Dashboard > SQL Editor > New query.
2. Copy all of supabase.sql into the editor and Run.
3. This creates the tables, row-level security policies, and a "videos" storage bucket.
4. Confirm Storage > videos exists.

STEP 3 — AUTH SETTINGS
1. Supabase Dashboard > Authentication > URL Configuration.
2. Set Site URL to the HTTPS URL where you will host the app.
3. Add the same URL to Redirect URLs (include localhost for local testing if needed).
4. Email/password: Authentication > Providers > Email. Enable email confirmations.
5. Google: Authentication > Providers > Google. Enable it and add the Google OAuth Client ID/Secret from Google Cloud Console.
   Add Supabase's displayed callback URL to the Google OAuth client's Authorized redirect URIs.
   Google setup requires a Google Cloud project and consent screen.
6. Phone OTP: Authentication > Providers > Phone. Enable it and configure a supported SMS provider.
   SMS delivery may cost money. Do not use a personal phone number as a public support number.

STEP 4 — TEST LOCALLY
1. Serve the folder using a local web server (not by opening index.html as file://).
2. Example with Python installed: open terminal in this folder and run:
   python -m http.server 8000
3. Visit http://localhost:8000
4. Sign up with an email, confirm the email, then log in.
5. Test Google/Phone only after completing their provider setup.

STEP 5 — PUBLISH AS ANDROID PWA
1. Upload the folder to a static HTTPS host (for example Netlify, Cloudflare Pages, or GitHub Pages).
2. Set the hosted URL in Supabase Authentication > URL Configuration.
3. Open the HTTPS site on Android Chrome > menu > Add to Home screen / Install app.
4. Re-test sign in, upload and playback on the installed PWA.

BEFORE PUBLIC LAUNCH
- Add a moderator/admin review dashboard and human response process for reports.
- Add block/mute, comment controls, spam/rate limiting, upload scanning, copyright takedown.
- Add age-appropriate privacy defaults and clear community guidelines.
- Avoid direct messages and public display of personal phone/email.
- Configure quotas, backups, logging and storage costs.
- Review applicable laws and platform policies with a responsible adult.
