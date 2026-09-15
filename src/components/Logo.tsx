import logo from "@/assets/eagle-logo.png";

const Logo = ({ size = 32 }: { size?: number }) => (
  <div className="flex items-center gap-2 shrink-0">
    <img src={logo} alt="EAGLEDEX" width={size} height={size}
      className="animate-pulse-glow shrink-0" style={{ width: size, height: size }} />
    <div className="leading-none hidden sm:block">
      <div className="font-extrabold tracking-tight text-base">
        EAGLE<span className="text-grad">DEX</span>
      </div>
      <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground hidden lg:block">SVPChain Testnet</div>
    </div>
  </div>
);

export default Logo;
