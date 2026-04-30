// Brand-accurate wallet glyphs as inline SVG so we don't depend on external assets.
// Colors match each wallet's primary palette.
import React from "react";

export const WalletIconBox = ({ children, bg }: { children: React.ReactNode; bg: string }) => (
  <div
    className="w-10 h-10 rounded-xl grid place-items-center shrink-0 shadow-sm"
    style={{ background: bg }}
  >
    {children}
  </div>
);

export const MetaMaskIcon = () => (
  <WalletIconBox bg="linear-gradient(135deg,#2a1305,#1a0a02)">
    <svg viewBox="0 0 32 32" width="22" height="22"><path fill="#E2761B" d="M28 4 17.7 11.6l1.9-4.5z"/><path fill="#E4761B" d="m4 4 10.2 7.7-1.8-4.6zM24 22.4l-2.7 4.2 5.8 1.6 1.7-5.7zM3.3 22.5 5 28.2l5.8-1.6-2.7-4.2z"/><path fill="#E4761B" d="m10.5 14.3-1.7 2.6 5.7.3-.2-6.1zM21.5 14.3 17.6 11l-.1 6.2 5.7-.3z"/><path fill="#E4761B" d="m10.8 26.6 3.5-1.7-3-2.3zM17.8 24.9l3.5 1.7-.5-4z"/><path fill="#D7C1B3" d="m21.3 26.6-3.5-1.7.3 2.3v1.5zM10.8 26.6l3.2 2.1V27l.3-2.3z"/><path fill="#233447" d="M14 21.4 11.2 20l2-.9zM18 21.4l.7-2.3 2 .9z"/><path fill="#CD6116" d="m10.8 26.6.5-4.2-3.2.1zM20.7 22.4l.5 4.2 2.8-4.1zM23.2 16.9l-5.7.3.5 3.2 1-2.3 2-.9zM11.2 20l2 .9 1-2.3.5-3.2-5.7-.3z"/><path fill="#E4751F" d="m9 16.9 2.4 4.7-.1-2.3zM20.8 19.3l-.1 2.3 2.5-4.7zM14.7 17.2l-1 2.3 1.3 6.3.3-8.3zM17.4 17.2l-.6.3.3 8.3 1.3-6.3z"/><path fill="#F6851B" d="m18.4 19.5-1.3 6.3.9.6 5.6-4.5.2-3.5zM8.8 18.4l.2 3.5 5.6 4.5.9--.6-1.3-6.3z"/><path fill="#C0AD9E" d="M18.5 28.7v-1.5l-.4-.4h-4.2l-.4.4v1.5l-3.2-2.1 1.1.9 2.3 1.6h4.6l2.3-1.6 1.1-.9z"/><path fill="#161616" d="m17.8 24.9-.9-.6h-1.8l-.9.6-.3 2.3.4-.4h4.2l.4.4z"/></svg>
  </WalletIconBox>
);

export const RabbyIcon = () => (
  <WalletIconBox bg="linear-gradient(135deg,#7084FF,#4061FF)">
    <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
      <path d="M22 11c-3-2-7-2-10 1-2 2-3 5-2 8 1 2 3 3 5 3 1 0 2 0 3-1 0 1 1 2 2 2 2 1 4 0 5-2 1-2 1-5-1-7l-2-4z" fill="#fff"/>
      <circle cx="20" cy="14" r="1.4" fill="#000"/>
    </svg>
  </WalletIconBox>
);

export const OKXIcon = () => (
  <WalletIconBox bg="#000">
    <svg viewBox="0 0 32 32" width="22" height="22" fill="#fff">
      <rect x="4" y="4" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/><rect x="22" y="22" width="7" height="7"/>
      <rect x="22" y="4" width="7" height="7"/><rect x="4" y="22" width="7" height="7"/>
    </svg>
  </WalletIconBox>
);

export const BitgetIcon = () => (
  <WalletIconBox bg="linear-gradient(135deg,#00F0FF,#00B7FF)">
    <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
      <path d="M16 4 6 14h6L8 22h12l-6-8h6z" fill="#000"/>
    </svg>
  </WalletIconBox>
);

export const SubWalletIcon = () => (
  <WalletIconBox bg="linear-gradient(135deg,#0094FF,#0066CC)">
    <svg viewBox="0 0 32 32" width="22" height="22" fill="#fff">
      <path d="M8 10h16v3H8zM8 15h11v3H8zM8 20h16v3H8z"/>
    </svg>
  </WalletIconBox>
);

export const CoinbaseIcon = () => (
  <WalletIconBox bg="#0052FF">
    <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
      <circle cx="16" cy="16" r="11" fill="#fff"/>
      <rect x="12" y="12" width="8" height="8" rx="1" fill="#0052FF"/>
    </svg>
  </WalletIconBox>
);

export const RainbowIcon = () => (
  <WalletIconBox bg="linear-gradient(135deg,#001E59,#3A1B6E)">
    <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
      <path d="M6 26v-2a14 14 0 0 1 14-14h2" stroke="#FF4000" strokeWidth="3" fill="none"/>
      <path d="M6 26v-4a10 10 0 0 1 10-10h6" stroke="#FFB800" strokeWidth="3" fill="none"/>
      <path d="M6 26v-6a6 6 0 0 1 6-6h10" stroke="#0AA1FF" strokeWidth="3" fill="none"/>
      <circle cx="6" cy="26" r="2.5" fill="#fff"/>
    </svg>
  </WalletIconBox>
);

export const WalletConnectIcon = () => (
  <WalletIconBox bg="linear-gradient(135deg,#3B99FC,#2B7CE9)">
    <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
      <path d="M9 14c4-4 10-4 14 0l.6.6a1 1 0 0 1 0 1.4l-2 2a.5.5 0 0 1-.7 0l-.9-.9c-2.7-2.6-7-2.6-9.7 0l-1 .9a.5.5 0 0 1-.7 0l-2-2a1 1 0 0 1 0-1.4z" fill="#fff"/>
    </svg>
  </WalletIconBox>
);

import type { WalletId } from "@/lib/web3";
export const WALLET_ICON: Record<WalletId, React.FC> = {
  metamask: MetaMaskIcon,
  rabby: RabbyIcon,
  okx: OKXIcon,
  bitget: BitgetIcon,
  subwallet: SubWalletIcon,
  coinbase: CoinbaseIcon,
  rainbow: RainbowIcon,
  walletconnect: WalletConnectIcon,
};
