-- LUMA Moments - run in Supabase SQL editor before enabling cloud features.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 handle text unique not null check(handle ~ '^[a-z0-9_]{3,24}$'),
 display_name text not null default '',
 avatar_url text,
 created_at timestamptz not null default now()
);
create table if not exists public.blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create table if not exists public.friend_requests(
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 unique(sender_id,recipient_id), check(sender_id<>recipient_id)
);
create table if not exists public.friendships (
 user_a uuid not null references auth.users(id) on delete cascade,
 user_b uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_a,user_b), check(user_a<user_b)
);
create table if not exists public.moments(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 media_path text not null unique,
 caption text not null default '' check(length(caption)<=240),
 created_at timestamptz not null default now()
);
create table if not exists public.moment_recipients(
 moment_id uuid not null references public.moments(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 primary key(moment_id,recipient_id)
);
create table if not exists public.reactions(
 moment_id uuid not null references public.moments(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 emoji text not null check(emoji in ('❤️','😂','😍','🥹','🔥','👏')),
 created_at timestamptz not null default now(),
 primary key(moment_id,user_id)
);
create table if not exists public.notifications(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 moment_id uuid references public.moments(id) on delete cascade,
 kind text not null check(kind in ('friend_request','friend_accepted','new_moment','reaction')),
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists moments_created_idx on public.moments(created_at desc);
create index if not exists recipient_idx on public.moment_recipients(recipient_id);
create index if not exists notif_user_idx on public.notifications(user_id,created_at desc);

create or replace function public.is_friend(a uuid,b uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from friendships where user_a=least(a,b) and user_b=greatest(a,b))
 and not exists(select 1 from blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
create or replace function public.can_view_moment(mid uuid,uid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from moments m where m.id=mid and (
 m.owner_id=uid or (exists(select 1 from moment_recipients r where r.moment_id=m.id and r.recipient_id=uid)
 and not exists(select 1 from blocks b where (b.blocker_id=uid and b.blocked_id=m.owner_id) or (b.blocker_id=m.owner_id and b.blocked_id=uid)))
 ));
$$;
revoke all on function public.is_friend(uuid,uuid) from public;
revoke all on function public.can_view_moment(uuid,uuid) from public;
grant execute on function public.is_friend(uuid,uuid), public.can_view_moment(uuid,uuid) to authenticated;
alter table public.profiles enable row level security;
alter table public.blocks enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.moments enable row level security;
alter table public.moment_recipients enable row level security;
alter table public.reactions enable row level security;
alter table public.notifications enable row level security;

create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "profile self insert" on public.profiles for insert to authenticated with check(id=auth.uid());
create policy "profile self update" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "block read own" on public.blocks for select to authenticated using(blocker_id=auth.uid());
create policy "block add own" on public.blocks for insert to authenticated with check(blocker_id=auth.uid());
create policy "block remove own" on public.blocks for delete to authenticated using(blocker_id=auth.uid());
create policy "requests relevant" on public.friend_requests for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid());
create policy "requests create" on public.friend_requests for insert to authenticated with check(
 sender_id=auth.uid() and sender_id<>recipient_id and not public.is_friend(sender_id,recipient_id)
 and not exists(select 1 from public.blocks where (blocker_id=sender_id and blocked_id=recipient_id) or (blocker_id=recipient_id and blocked_id=sender_id))
);
create policy "requests recipient response" on public.friend_requests for update to authenticated using(recipient_id=auth.uid() and status='pending') with check(recipient_id=auth.uid() and status in ('accepted','declined'));
create policy "friendship read own" on public.friendships for select to authenticated using(auth.uid() in (user_a,user_b));
create policy "moments read authorized" on public.moments for select to authenticated using(public.can_view_moment(id,auth.uid()));
create policy "recipients own" on public.moment_recipients for select to authenticated using(recipient_id=auth.uid() or exists(select 1 from public.moments m where m.id=moment_id and m.owner_id=auth.uid()));
create policy "reactions view" on public.reactions for select to authenticated using(public.can_view_moment(moment_id,auth.uid()));
create policy "reactions insert self" on public.reactions for insert to authenticated with check(user_id=auth.uid() and public.can_view_moment(moment_id,auth.uid()));
create policy "reactions update self" on public.reactions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and public.can_view_moment(moment_id,auth.uid()));
create policy "notifications own" on public.notifications for select to authenticated using(user_id=auth.uid());
create policy "notifications mark read" on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create or replace function public.on_friend_response() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.status='pending' and new.status='accepted' then
  insert into friendships(user_a,user_b) values(least(new.sender_id,new.recipient_id),greatest(new.sender_id,new.recipient_id)) on conflict do nothing;
  insert into notifications(user_id,actor_id,kind) values(new.sender_id,new.recipient_id,'friend_accepted');
 end if;
 return new;
end $$;
create trigger friend_response after update of status on public.friend_requests for each row execute function public.on_friend_response();
create or replace function public.on_friend_request() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into notifications(user_id,actor_id,kind) values(new.recipient_id,new.sender_id,'friend_request');
 return new;
end $$;
create trigger new_friend_request after insert on public.friend_requests for each row execute function public.on_friend_request();

create or replace function public.publish_moment(p_media_path text,p_caption text,p_recipients uuid[])
returns uuid language plpgsql security definer set search_path=public as $$
declare who uuid:=auth.uid(); id uuid; recipient uuid;
begin
 if who is null then raise exception 'Not authenticated'; end if;
 if p_media_path !~ ('^'||who::text||'/[a-zA-Z0-9_-]+\\.jpg$') then raise exception 'Invalid media ownership'; end if;
 if coalesce(array_length(p_recipients,1),0)=0 or array_length(p_recipients,1)>50 then raise exception 'Invalid recipients'; end if;
 foreach recipient in array p_recipients loop
  if not public.is_friend(who,recipient) then raise exception 'Recipient is not a friend'; end if;
 end loop;
 if not exists(select 1 from storage.objects where bucket_id='moments' and name=p_media_path and owner_id=who::text) then raise exception 'Upload not found'; end if;
 insert into moments(owner_id,media_path,caption) values(who,p_media_path,left(coalesce(p_caption,''),240)) returning moments.id into id;
 foreach recipient in array p_recipients loop
  insert into moment_recipients(moment_id,recipient_id) values(id,recipient) on conflict do nothing;
  insert into notifications(user_id,actor_id,moment_id,kind) values(recipient,who,id,'new_moment');
 end loop;
 return id;
end $$;
revoke all on function public.publish_moment(text,text,uuid[]) from public;
grant execute on function public.publish_moment(text,text,uuid[]) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('moments','moments',false,10485760,array['image/jpeg'])
on conflict(id) do update set public=false;
create policy "upload own photos" on storage.objects for insert to authenticated
with check(bucket_id='moments' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "read owned and shared photos" on storage.objects for select to authenticated using(
 bucket_id='moments' and (
 (storage.foldername(name))[1]=auth.uid()::text
 or exists(select 1 from public.moments m where m.media_path=name and public.can_view_moment(m.id,auth.uid()))
 )
);
