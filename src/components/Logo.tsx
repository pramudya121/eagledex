import logo from "@/assets/eagle-logo.png";

const Logo = ({ size = 36 }: { size?: number }) => (
  <div className="flex items-center gap-2.5">
    <img src={logo} alt="EAGLEDEX" width={size} height={size}
      className="animate-pulse-glow" style={{ width: size, height: size }} />
    <div className="leading-none">
      <div className="font-extrabold tracking-tight text-lg">
        EAGLE<span className="text-grad">DEX</span>
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Integralayer Testnet</div>
    </div>
  </div>
);

export default Logo;
