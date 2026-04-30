const WaveBackground = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
    <div className="absolute inset-0 bg-background" />
    <svg className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] animate-wave opacity-70" viewBox="0 0 1200 800" preserveAspectRatio="none">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(0 84% 55%)" stopOpacity="0.45" />
          <stop offset="50%" stopColor="hsl(14 95% 58%)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(0 0% 0%)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="g2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(0 84% 45%)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(0 0% 0%)" stopOpacity="0" />
        </linearGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="40" /></filter>
      </defs>
      <path filter="url(#blur)" fill="url(#g1)" d="M0,400 C300,200 600,600 1200,300 L1200,0 L0,0 Z" />
      <path filter="url(#blur)" fill="url(#g2)" d="M0,500 C400,700 800,300 1200,600 L1200,800 L0,800 Z" />
    </svg>
    <svg className="absolute top-0 left-0 w-full h-full opacity-40" viewBox="0 0 1200 800" preserveAspectRatio="none">
      <path fill="none" stroke="hsl(0 84% 55% / 0.25)" strokeWidth="1.5">
        <animate attributeName="d" dur="14s" repeatCount="indefinite"
          values="M0,420 C300,300 600,540 1200,380; M0,400 C300,520 600,280 1200,460; M0,420 C300,300 600,540 1200,380" />
      </path>
      <path fill="none" stroke="hsl(14 95% 58% / 0.2)" strokeWidth="1">
        <animate attributeName="d" dur="18s" repeatCount="indefinite"
          values="M0,520 C400,400 800,640 1200,480; M0,500 C400,620 800,380 1200,560; M0,520 C400,400 800,640 1200,480" />
      </path>
    </svg>
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_transparent_30%,_hsl(0_0%_0%/0.6)_90%)]" />
  </div>
);

export default WaveBackground;
