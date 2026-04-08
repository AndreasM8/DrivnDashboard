-- Set seb@stroemagency.com as admin
update public.users
set role = 'admin'
where id = (
  select id from auth.users where email = 'seb@stroemagency.com'
);
