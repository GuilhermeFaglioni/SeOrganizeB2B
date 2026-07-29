INSERT INTO public.profiles ("id","email","name","updated_at")
  SELECT
    u.id::text,
    u.email::text,
    'Guilherme',
    NOW()
  FROM auth.users AS u
  WHERE u.email = 'guilhermefaglioni.contato@gmail.com'
  ON CONFLICT ("id") DO UPDATE SET
    "email" = EXCLUDED."email",
    "name" = EXCLUDED."name",
    "updated_at" = NOW();