-- Database schema for Anudan (copy into Supabase SQL editor and run)

-- Extensions
create extension if not exists pgcrypto;

-- Profiles: avatar only; name and email come from auth.users
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  avatar_url text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Donation items: includes image_path stored in "donation-images" bucket
-- AFTER (add poster_name column)
create table if not exists public.donation_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  image_path text not null,
  poster_name text,                          -- ← ADD THIS LINE
  latitude double precision,
  longitude double precision,
  location_label text,
  status text not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Request items: no image, avatar fetched via profiles
create table if not exists public.request_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  poster_name text,
  latitude double precision,
  longitude double precision,
  location_label text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill-safe migrations for existing deployments
alter table public.donation_items add column if not exists latitude double precision;
alter table public.donation_items add column if not exists longitude double precision;
alter table public.donation_items add column if not exists location_label text;
alter table public.request_items add column if not exists poster_name text;
alter table public.request_items add column if not exists latitude double precision;
alter table public.request_items add column if not exists longitude double precision;
alter table public.request_items add column if not exists location_label text;

-- Indexes
create index if not exists donation_items_user_id_idx on public.donation_items(user_id);
create index if not exists donation_items_created_at_idx on public.donation_items(created_at desc);
create index if not exists request_items_user_id_idx on public.request_items(user_id);
create index if not exists request_items_created_at_idx on public.request_items(created_at desc);

-- Trigger to maintain updated_at
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_profile on public.profiles;
create trigger set_updated_at_profile before update on public.profiles for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_donation on public.donation_items;
create trigger set_updated_at_donation before update on public.donation_items for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_request on public.request_items;
create trigger set_updated_at_request before update on public.request_items for each row execute function public.set_updated_at();

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.donation_items enable row level security;
alter table public.request_items enable row level security;

-- RLS Policies: profiles
drop policy if exists "Profiles readable by authenticated" on public.profiles;
create policy "Profiles readable by authenticated" on public.profiles for select using (auth.role() = 'authenticated');

drop policy if exists "Insert own profile" on public.profiles;
create policy "Insert own profile" on public.profiles for insert with check (auth.uid() = user_id);

drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Delete own profile" on public.profiles;
create policy "Delete own profile" on public.profiles for delete using (auth.uid() = user_id);

-- RLS Policies: donation_items
drop policy if exists "Donation items readable by authenticated" on public.donation_items;
create policy "Donation items readable by authenticated" on public.donation_items for select using (auth.role() = 'authenticated');

drop policy if exists "Insert own donation item" on public.donation_items;
create policy "Insert own donation item" on public.donation_items for insert with check (auth.uid() = user_id);

drop policy if exists "Update own donation item" on public.donation_items;
create policy "Update own donation item" on public.donation_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Delete own donation item" on public.donation_items;
create policy "Delete own donation item" on public.donation_items for delete using (auth.uid() = user_id);

-- RLS Policies: request_items
drop policy if exists "Request items readable by authenticated" on public.request_items;
create policy "Request items readable by authenticated" on public.request_items for select using (auth.role() = 'authenticated');

drop policy if exists "Insert own request item" on public.request_items;
create policy "Insert own request item" on public.request_items for insert with check (auth.uid() = user_id);

drop policy if exists "Update own request item" on public.request_items;
create policy "Update own request item" on public.request_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Delete own request item" on public.request_items;
create policy "Delete own request item" on public.request_items for delete using (auth.uid() = user_id);

-- Storage: buckets for avatars and donation images
-- FIX: Added 'name' column which is required (not-null) in storage.buckets
insert into storage.buckets(id, name) values('avatars', 'avatars') on conflict (id) do nothing;
update storage.buckets set public = true where id = 'avatars';
insert into storage.buckets(id, name) values('donation-images', 'donation-images') on conflict (id) do nothing;
update storage.buckets set public = true where id = 'donation-images';

-- Storage policies for avatars bucket
drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "Upload avatars by owner" on storage.objects;
create policy "Upload avatars by owner" on storage.objects for insert with check (bucket_id = 'avatars' and owner = auth.uid());

drop policy if exists "Update avatars by owner" on storage.objects;
create policy "Update avatars by owner" on storage.objects for update using (bucket_id = 'avatars' and owner = auth.uid()) with check (bucket_id = 'avatars' and owner = auth.uid());

drop policy if exists "Delete avatars by owner" on storage.objects;
create policy "Delete avatars by owner" on storage.objects for delete using (bucket_id = 'avatars' and owner = auth.uid());

-- Storage policies for donation-images bucket
drop policy if exists "Public read donation images" on storage.objects;
create policy "Public read donation images" on storage.objects for select using (bucket_id = 'donation-images');

drop policy if exists "Upload donation image by owner" on storage.objects;
create policy "Upload donation image by owner" on storage.objects for insert with check (bucket_id = 'donation-images' and owner = auth.uid());

drop policy if exists "Update donation image by owner" on storage.objects;
create policy "Update donation image by owner" on storage.objects for update using (bucket_id = 'donation-images' and owner = auth.uid()) with check (bucket_id = 'donation-images' and owner = auth.uid());

drop policy if exists "Delete donation image by owner" on storage.objects;
create policy "Delete donation image by owner" on storage.objects for delete using (bucket_id = 'donation-images' and owner = auth.uid());

-- 1. Drop existing chat tables to clear stale references
drop table if exists public.chat_messages;
drop table if exists public.chat_rooms;

-- 2. Recreate Chat Rooms referencing public.profiles (much more stable for Supabase)
create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  participant1_id uuid not null references public.profiles(user_id) on delete cascade,
  participant2_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(participant1_id, participant2_id)
);

-- 3. Recreate Chat Messages
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(user_id) on delete cascade,
  text text not null,
  is_read boolean not null default false, -- Seen marker
  created_at timestamptz not null default now()
);

-- 4. Re-enable RLS and Policies
alter table public.chat_rooms enable row level security;
create policy "Users can see rooms they are in" on public.chat_rooms
  for select using (auth.uid() = participant1_id or auth.uid() = participant2_id);
create policy "Users can create rooms" on public.chat_rooms
  for insert with check (auth.uid() = participant1_id or auth.uid() = participant2_id);

alter table public.chat_messages enable row level security;
create policy "Users can see messages in their rooms" on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_rooms
      where id = chat_messages.room_id
      and (participant1_id = auth.uid() or participant2_id = auth.uid())
    )
  );
create policy "Users can insert messages in their rooms" on public.chat_messages
  for insert with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.chat_rooms
      where id = chat_messages.room_id
      and (participant1_id = auth.uid() or participant2_id = auth.uid())
    )
  );

create policy "Users can update is_read for messages in their rooms" on public.chat_messages
  for update using (
    exists (
      select 1 from public.chat_rooms
      where id = chat_messages.room_id
      and (participant1_id = auth.uid() or participant2_id = auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.chat_rooms
      where id = chat_messages.room_id
      and (participant1_id = auth.uid() or participant2_id = auth.uid())
    )
  );

-- 5. Add trigger for updated_at
create trigger set_updated_at_chat_rooms before update on public.chat_rooms
  for each row execute function public.set_updated_at();

-- 6. IMPORTANT: Force a schema cache refresh (PostgREST)
notify pgrst, 'reload schema';

-- Notes:
-- Store avatars under key: '<user_id>/avatar.jpg' or similar in 'avatars' bucket.
-- Store donation images under key: '<donation_item_id>/<filename>' in 'donation-images' bucket.
-- Reading is public; writing/updating/deleting is restricted to object owners. Make sure clients are authenticated when uploading.
