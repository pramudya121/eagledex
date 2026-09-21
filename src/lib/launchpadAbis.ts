// EAGLEDEX Launchpad — ABIs (human-readable, ethers v6).

export const LAUNCHPAD_FACTORY_ABI = [
  "function createToken(string name, string symbol) payable returns (address, address)",
  "function allTokens(uint256) view returns (address token, address curve, address creator, uint256 createdAt)",
  "function getAllTokensLength() view returns (uint256)",
  "function tokenToCurve(address) view returns (address)",
  "function creationFee() view returns (uint256)",
  "function feeRecipient() view returns (address)",
  "function uniswapRouter() view returns (address)",
  "function owner() view returns (address)",
  "function setCreationFee(uint256) ",
  "function setFeeRecipient(address)",
  "function transferOwnership(address)",
  "event TokenLaunched(address indexed token, address indexed curve, address indexed creator, string name, string symbol)",
];

export const FEE_MANAGER_ABI = [
  "function treasury() view returns (address)",
  "function teamWallet() view returns (address)",
  "function marketingWallet() view returns (address)",
  "function treasuryShare() view returns (uint256)",
  "function teamShare() view returns (uint256)",
  "function marketingShare() view returns (uint256)",
  "function paused() view returns (bool)",
  "function owner() view returns (address)",
  "function isAuthorizedCollector(address) view returns (bool)",
  "function distributeETH()",
  "function distributeToken(address token)",
  "function receiveToken(address token, uint256 amount)",
  "function setShares(uint256 treasuryShare, uint256 teamShare, uint256 marketingShare)",
  "function setWallets(address treasury, address team, address marketing)",
  "function setCollector(address collector, bool status)",
  "function pause()",
  "function unpause()",
  "function emergencyWithdrawETH()",
  "function emergencyWithdrawToken(address token)",
  "function transferOwnership(address)",
  "event FeeDistributed(address indexed token, uint256 treasuryAmount, uint256 teamAmount, uint256 marketingAmount)",
  "event FeeReceived(address indexed token, uint256 amount, address indexed from)",
];

export const ANTIBOT_ABI = [
  "function check(address user, uint256 amount) view returns (bool)",
  "function cooldownTime() view returns (uint256)",
  "function maxTxAmount() view returns (uint256)",
  "function whitelistEnabled() view returns (bool)",
  "function isBlacklisted(address) view returns (bool)",
  "function isWhitelisted(address) view returns (bool)",
  "function lastTxTime(address) view returns (uint256)",
  "function getUserStatus(address) view returns (bool blacklisted, bool whitelisted, uint256 lastTx, bool canTx)",
  "function MIN_COOLDOWN() view returns (uint256)",
  "function MAX_COOLDOWN() view returns (uint256)",
  "function MAX_TX_LIMIT() view returns (uint256)",
  "function owner() view returns (address)",
  "function setBlacklist(address account, bool status)",
  "function setBlacklistBatch(address[] accounts, bool status)",
  "function setWhitelist(address account, bool status)",
  "function setWhitelistBatch(address[] accounts, bool status)",
  "function setWhitelistEnabled(bool enabled)",
  "function setCooldown(uint256 seconds_)",
  "function setMaxTxAmount(uint256 amount)",
  "function transferOwnership(address)",
];

export const REFERRAL_ABI = [
  "function referrerOf(address) view returns (address)",
  "function referralEarnings(address) view returns (uint256)",
  "function totalReferred(address) view returns (uint256)",
  "function referralFeeBps() view returns (uint256)",
  "function feeManager() view returns (address)",
  "function owner() view returns (address)",
  "function getReferralInfo(address) view returns (address referrer, uint256 earnings, uint256 referred)",
  "function registerReferral(address referrer)",
  "function payReferral(address user, uint256 amount) payable",
  "function setReferralFeeBps(uint256 bps)",
  "function setFeeManager(address)",
  "function transferOwnership(address)",
];

export const LP_LOCKER_ABI = [
  "function lock(address token, uint256 amount, uint256 duration) returns (uint256)",
  "function extendLock(uint256 lockId, uint256 newUnlockTime)",
  "function withdraw(uint256 lockId)",
  "function locks(uint256) view returns (address token, address owner, uint256 amount, uint256 unlockTime, bool withdrawn)",
  "function getUserLocks(address) view returns (uint256[])",
  "function lockIdCounter() view returns (uint256)",
  "function minLockDuration() view returns (uint256)",
  "function maxLockDuration() view returns (uint256)",
  "function owner() view returns (address)",
  "function setMinMaxDuration(uint256 min, uint256 max)",
  "function transferOwnership(address)",
];

/**
 * BondingCurve is deployed by the factory, and its ABI was not supplied.
 * These are the conventional signatures; every read is attempted defensively
 * (see src/lib/launchpad.ts) so unsupported methods simply hide their UI.
 */
export const BONDING_CURVE_ABI = [
  "function buy(uint256 minTokensOut) payable",
  "function sell(uint256 tokenAmount, uint256 minEthOut)",
  "function token() view returns (address)",
  "function creator() view returns (address)",
  "function graduated() view returns (bool)",
  "function virtualEthReserves() view returns (uint256)",
  "function virtualTokenReserves() view returns (uint256)",
  "function realEthReserves() view returns (uint256)",
  "function realTokenReserves() view returns (uint256)",
  "function getCurrentPrice() view returns (uint256)",
  "function getTokensForEth(uint256 ethAmount) view returns (uint256)",
  "function getEthForTokens(uint256 tokenAmount) view returns (uint256)",
];
