DROP TABLE IF EXISTS notification;
CREATE TABLE notification (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
WITH RECURSIVE seq(n) AS (
  SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 10000
)
INSERT INTO notification(id,user_id,created_at)
SELECT n, 'user-' || (n % 100), n FROM seq;
SELECT count(*) AS fixture_rows FROM notification;
EXPLAIN QUERY PLAN
SELECT id FROM notification WHERE user_id='user-42' AND created_at>=9000 ORDER BY created_at DESC;
CREATE INDEX idx_user_created ON notification(user_id,created_at);
EXPLAIN QUERY PLAN
SELECT id FROM notification WHERE user_id='user-42' AND created_at>=9000 ORDER BY created_at DESC;
SELECT 'user_created' AS variant, count(*) AS matching_rows, sum(id) AS id_sum FROM notification WHERE user_id='user-42' AND created_at>=9000;
SELECT 'user_created' AS variant, id FROM notification WHERE user_id='user-42' AND created_at>=9000 ORDER BY created_at DESC;
DROP INDEX idx_user_created;
CREATE INDEX idx_created_user ON notification(created_at,user_id);
EXPLAIN QUERY PLAN
SELECT id FROM notification WHERE user_id='user-42' AND created_at>=9000 ORDER BY created_at DESC;
SELECT 'created_user' AS variant, count(*) AS matching_rows, sum(id) AS id_sum FROM notification WHERE user_id='user-42' AND created_at>=9000;
SELECT 'created_user' AS variant, id FROM notification WHERE user_id='user-42' AND created_at>=9000 ORDER BY created_at DESC;
