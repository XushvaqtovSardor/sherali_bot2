-- Insert first admin (replace with your Telegram ID)
-- Get your Telegram ID by messaging @userinfobot on Telegram

INSERT INTO admins (id, telegram_id, username, created_at)
VALUES (
  gen_random_uuid(),
  '7878916781',  -- Replace with your Telegram ID
  'your_username',  -- Replace with your username
  NOW()
)
ON CONFLICT (telegram_id) DO NOTHING;
