
-- EAGLEDEX persistent indexer tables
CREATE TABLE public.indexer_cursor (
  chain_id INTEGER PRIMARY KEY,
  last_block BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.pair_events (
  id BIGSERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  pair TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'swap' | 'mint' | 'burn' | 'sync' | 'pair_created'
  block_number BIGINT NOT NULL,
  block_ts TIMESTAMPTZ NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  amount0_in NUMERIC,
  amount1_in NUMERIC,
  amount0_out NUMERIC,
  amount1_out NUMERIC,
  amount0 NUMERIC,
  amount1 NUMERIC,
  reserve0 NUMERIC,
  reserve1 NUMERIC,
  sender TEXT,
  to_addr TEXT,
  token0 TEXT,
  token1 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chain_id, tx_hash, log_index)
);
CREATE INDEX idx_pair_events_pair_ts ON public.pair_events (pair, block_ts DESC);
CREATE INDEX idx_pair_events_type_ts ON public.pair_events (event_type, block_ts DESC);

CREATE TABLE public.pairs_state (
  pair TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  token0 TEXT NOT NULL,
  token1 TEXT NOT NULL,
  symbol0 TEXT,
  symbol1 TEXT,
  decimals0 INTEGER NOT NULL DEFAULT 18,
  decimals1 INTEGER NOT NULL DEFAULT 18,
  reserve0 NUMERIC NOT NULL DEFAULT 0,
  reserve1 NUMERIC NOT NULL DEFAULT 0,
  total_supply NUMERIC NOT NULL DEFAULT 0,
  created_block BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.indexer_cursor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pair_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairs_state ENABLE ROW LEVEL SECURITY;

-- Public read (analytics is public data)
CREATE POLICY "public read cursor" ON public.indexer_cursor FOR SELECT USING (true);
CREATE POLICY "public read events" ON public.pair_events FOR SELECT USING (true);
CREATE POLICY "public read state" ON public.pairs_state FOR SELECT USING (true);

-- Aggregation views: 24h / 7d volume per pair
CREATE OR REPLACE VIEW public.pair_volume_24h AS
SELECT pair,
       SUM(COALESCE(amount0_in,0) + COALESCE(amount0_out,0)) AS volume0,
       SUM(COALESCE(amount1_in,0) + COALESCE(amount1_out,0)) AS volume1,
       COUNT(*) AS swap_count
FROM public.pair_events
WHERE event_type = 'swap' AND block_ts >= now() - interval '24 hours'
GROUP BY pair;

CREATE OR REPLACE VIEW public.pair_volume_7d AS
SELECT pair,
       SUM(COALESCE(amount0_in,0) + COALESCE(amount0_out,0)) AS volume0,
       SUM(COALESCE(amount1_in,0) + COALESCE(amount1_out,0)) AS volume1,
       COUNT(*) AS swap_count
FROM public.pair_events
WHERE event_type = 'swap' AND block_ts >= now() - interval '7 days'
GROUP BY pair;
