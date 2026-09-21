CREATE TABLE public.launch_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id integer NOT NULL,
  token_address text NOT NULL,
  curve_address text,
  creator text NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL,
  description text,
  logo_path text,
  website text,
  twitter text,
  telegram text,
  total_supply numeric,
  decimals integer NOT NULL DEFAULT 18,
  tx_hash text,
  verified boolean NOT NULL DEFAULT false,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, token_address)
);
GRANT SELECT, INSERT ON public.launch_tokens TO anon, authenticated;
GRANT ALL ON public.launch_tokens TO service_role;
ALTER TABLE public.launch_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "launch_tokens public read" ON public.launch_tokens FOR SELECT USING (true);
CREATE POLICY "launch_tokens public insert" ON public.launch_tokens FOR INSERT WITH CHECK (true);

CREATE TABLE public.token_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id integer NOT NULL,
  token_address text NOT NULL,
  price numeric NOT NULL,
  amount numeric NOT NULL,
  eth_amount numeric,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  tx_hash text,
  trader text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX token_trades_token_idx ON public.token_trades (chain_id, token_address, created_at DESC);
CREATE UNIQUE INDEX token_trades_tx_idx ON public.token_trades (chain_id, tx_hash) WHERE tx_hash IS NOT NULL;
GRANT SELECT, INSERT ON public.token_trades TO anon, authenticated;
GRANT ALL ON public.token_trades TO service_role;
ALTER TABLE public.token_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "token_trades public read" ON public.token_trades FOR SELECT USING (true);
CREATE POLICY "token_trades public insert" ON public.token_trades FOR INSERT WITH CHECK (true);
ALTER TABLE public.token_trades REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.token_trades;

CREATE TABLE public.token_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id integer NOT NULL,
  token_address text NOT NULL,
  wallet text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, token_address, wallet)
);
GRANT SELECT, INSERT, DELETE ON public.token_favorites TO anon, authenticated;
GRANT ALL ON public.token_favorites TO service_role;
ALTER TABLE public.token_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites public read" ON public.token_favorites FOR SELECT USING (true);
CREATE POLICY "favorites public insert" ON public.token_favorites FOR INSERT WITH CHECK (true);
CREATE POLICY "favorites public delete" ON public.token_favorites FOR DELETE USING (true);

CREATE POLICY "token logos read" ON storage.objects FOR SELECT USING (bucket_id = 'token-logos');
CREATE POLICY "token logos upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'token-logos');