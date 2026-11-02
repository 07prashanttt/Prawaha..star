-- Prawaha Star starter schema. Run in Supabase Dashboard > SQL Editor.
-- This starter is not a complete production moderation system.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Creator' check (char_length(display_name) between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  caption text not null check (char_length(caption) between 1 and 180),
  video_path text not null unique,
  status text not null default 'published' check (status in ('published','removed','under_review')),
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,video_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id),
  check (follower_id <> following_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  reason text not null,
  details text check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  unique(reporter_id,video_id)
);

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.reports enable row level security;

create policy "Profiles are viewable" on public.profiles for select to authenticated using (true);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid()=id);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid()=id) with check (auth.uid()=id);

create policy "Published videos visible" on public.videos for select to authenticated using (status='published' or auth.uid()=user_id);
create policy "Users create own videos" on public.videos for insert to authenticated with check (auth.uid()=user_id);
create policy "Owners update own videos" on public.videos for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "Owners delete own videos" on public.videos for delete to authenticated using (auth.uid()=user_id);

create policy "Likes visible to signed-in users" on public.likes for select to authenticated using (true);
create policy "Users like as themselves" on public.likes for insert to authenticated with check (auth.uid()=user_id);
create policy "Users remove own likes" on public.likes for delete to authenticated using (auth.uid()=user_id);

create policy "Comments visible to signed-in users" on public.comments for select to authenticated using (true);
create policy "Users add own comments" on public.comments for insert to authenticated with check (auth.uid()=user_id);
create policy "Users delete own comments" on public.comments for delete to authenticated using (auth.uid()=user_id);

create policy "Follows visible to signed-in users" on public.follows for select to authenticated using (true);
create policy "Users follow as themselves" on public.follows for insert to authenticated with check (auth.uid()=follower_id);
create policy "Users unfollow as themselves" on public.follows for delete to authenticated using (auth.uid()=follower_id);

create policy "Users submit reports" on public.reports for insert to authenticated with check (auth.uid()=reporter_id);
create policy "Users see own reports" on public.reports for select to authenticated using (auth.uid()=reporter_id);

-- Create a PUBLIC bucket named "videos" in Storage, then add these policies.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('videos','videos',true,104857600,array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public=true,file_size_limit=104857600,allowed_mime_types=array['video/mp4','video/webm','video/quicktime'];

create policy "Signed-in users read video files" on storage.objects for select to authenticated using (bucket_id='videos');
create policy "Users upload to own folder" on storage.objects for insert to authenticated with check (bucket_id='videos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Users update own video files" on storage.objects for update to authenticated using (bucket_id='videos' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='videos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Users delete own video files" on storage.objects for delete to authenticated using (bucket_id='videos' and (storage.foldername(name))[1]=auth.uid()::text);

-- Important: This starter's bucket is public so feed playback links work without signed URLs.
-- The storage SELECT policy above restricts API listing; public object URLs are still accessible to anyone
-- who has a link. For a real public social app, add moderation, takedown, rate limits, age controls,
-- abuse handling, and a server-side review pipeline before launch.