CREATE SCHEMA IF NOT EXISTS altum;
REVOKE ALL ON SCHEMA altum FROM PUBLIC;
CREATE SEQUENCE IF NOT EXISTS altum.order_number START 10001;
CREATE TABLE IF NOT EXISTS altum.orders (
  id uuid PRIMARY KEY,
  number bigint NOT NULL DEFAULT nextval('altum.order_number') UNIQUE,
  request_key uuid NOT NULL UNIQUE,
  token text NOT NULL UNIQUE,
  quote jsonb NOT NULL,
  language text NOT NULL,
  live boolean NOT NULL,
  session_id text UNIQUE,
  state text NOT NULL DEFAULT 'checkout_pending',
  customer jsonb,
  provider_id text,
  tracking jsonb NOT NULL DEFAULT '[]',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS altum.events (
  id text PRIMARY KEY, provider text NOT NULL, order_id uuid REFERENCES altum.orders(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS altum.rate_limits (
  key text PRIMARY KEY, hits integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL
);
ALTER TABLE altum.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE altum.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE altum.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA altum FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA altum FROM PUBLIC;
CREATE INDEX IF NOT EXISTS orders_queue ON altum.orders (created_at) WHERE state = 'paid';
