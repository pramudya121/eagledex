import { Helmet } from "react-helmet-async";

const SITE = "https://eagledex.lovable.app";

interface Props {
  title: string;
  description: string;
  path: string;
  jsonLd?: Record<string, unknown>;
}

/** Per-route SEO: unique title, description, canonical and og:* tags. */
export default function Seo({ title, description, path, jsonLd }: Props) {
  const url = `${SITE}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
