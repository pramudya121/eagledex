// On-chain ABIs for EAGLEDEX
export const FACTORY_ABI = [
  "function createPair(address tokenA, address tokenB) returns (address pair)",
  "function setFeeTo(address _feeTo)",
  "function setFeeToSetter(address _feeToSetter)",
  "function getPair(address, address) view returns (address)",
  "function allPairs(uint256) view returns (address)",
  "function allPairsLength() view returns (uint256)",
  "function feeTo() view returns (address)",
  "function feeToSetter() view returns (address)",
  "function INIT_CODE_PAIR_HASH() view returns (bytes32)",
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
];

export const ROUTER_ABI = [
  "function factory() view returns (address)",
  "function WETH() view returns (address)",
  "function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) pure returns (uint256)",
  "function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) pure returns (uint256)",
  "function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) pure returns (uint256)",
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])",
  "function getAmountsIn(uint256 amountOut, address[] path) view returns (uint256[])",
  "function addLiquidity(address tokenA,address tokenB,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256 amountA,uint256 amountB,uint256 liquidity)",
  "function addLiquidityETH(address token,uint256 amountTokenDesired,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) payable returns (uint256 amountToken,uint256 amountETH,uint256 liquidity)",
  "function removeLiquidity(address tokenA,address tokenB,uint256 liquidity,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256 amountA,uint256 amountB)",
  "function removeLiquidityETH(address token,uint256 liquidity,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) returns (uint256 amountToken,uint256 amountETH)",
  "function removeLiquidityETHSupportingFeeOnTransferTokens(address token,uint256 liquidity,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) returns (uint256 amountETH)",
  "function removeLiquidityWithPermit(address tokenA,address tokenB,uint256 liquidity,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline,bool approveMax,uint8 v,bytes32 r,bytes32 s) returns (uint256 amountA,uint256 amountB)",
  "function removeLiquidityETHWithPermit(address token,uint256 liquidity,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline,bool approveMax,uint8 v,bytes32 r,bytes32 s) returns (uint256 amountToken,uint256 amountETH)",
  "function removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(address token,uint256 liquidity,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline,bool approveMax,uint8 v,bytes32 r,bytes32 s) returns (uint256 amountETH)",
  "function swapExactTokensForTokens(uint256 amountIn,uint256 amountOutMin,address[] path,address to,uint256 deadline) returns (uint256[] amounts)",
  "function swapTokensForExactTokens(uint256 amountOut,uint256 amountInMax,address[] path,address to,uint256 deadline) returns (uint256[] amounts)",
  "function swapExactETHForTokens(uint256 amountOutMin,address[] path,address to,uint256 deadline) payable returns (uint256[] amounts)",
  "function swapETHForExactTokens(uint256 amountOut,address[] path,address to,uint256 deadline) payable returns (uint256[] amounts)",
  "function swapExactTokensForETH(uint256 amountIn,uint256 amountOutMin,address[] path,address to,uint256 deadline) returns (uint256[] amounts)",
  "function swapTokensForExactETH(uint256 amountOut,uint256 amountInMax,address[] path,address to,uint256 deadline) returns (uint256[] amounts)",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn,uint256 amountOutMin,address[] path,address to,uint256 deadline)",
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin,address[] path,address to,uint256 deadline) payable",
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn,uint256 amountOutMin,address[] path,address to,uint256 deadline)",
];

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

export const WETH_ABI = [
  ...ERC20_ABI,
  "function deposit() payable",
  "function withdraw(uint256 wad)",
  "event Deposit(address indexed dst, uint256 wad)",
  "event Withdrawal(address indexed src, uint256 wad)",
];

export const PAIR_ABI = [
  ...ERC20_ABI,
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function kLast() view returns (uint256)",
  "event Mint(address indexed sender, uint256 amount0, uint256 amount1)",
  "event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to)",
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
  "event Sync(uint112 reserve0, uint112 reserve1)",
];

export const MULTICALL_ABI = [
  "function aggregate(tuple(address target, bytes callData)[] calls) returns (uint256 blockNumber, bytes[] returnData)",
  "function getEthBalance(address addr) view returns (uint256)",
  "function getCurrentBlockTimestamp() view returns (uint256)",
  "function getBlockHash(uint256 blockNumber) view returns (bytes32)",
  "function getLastBlockHash() view returns (bytes32)",
  "function getCurrentBlockCoinbase() view returns (address)",
  "function getCurrentBlockDifficulty() view returns (uint256)",
  "function getCurrentBlockGasLimit() view returns (uint256)",
];

// MasterChef-like farming contract on Integralayer
export const FARM_ABI = [
  "function owner() view returns (address)",
  "function poolInfo(uint256) view returns (address stakingToken, address rewardToken, uint256 lastRewardBlock, uint256 accRewardPerShare, uint256 rewardPerBlock, uint256 totalStaked)",
  "function userInfo(uint256, address) view returns (uint256 amount, uint256 rewardDebt)",
  "function pendingReward(uint256 _pid, address _user) view returns (uint256)",
  "function deposit(uint256 _pid, uint256 _amount)",
  "function withdraw(uint256 _pid, uint256 _amount)",
  "function emergencyWithdraw(uint256 _pid)",
  "function massUpdatePools()",
  "function updatePool(uint256 _pid)",
  "function addPool(address _stakingToken, address _rewardToken, uint256 _rewardPerBlock)",
  "function updateRewardPerBlock(uint256 _pid, uint256 _rewardPerBlock)",
  "function transferOwnership(address newOwner)",
  "event Deposit(address indexed user, uint256 indexed pid, uint256 amount)",
  "event Withdraw(address indexed user, uint256 indexed pid, uint256 amount)",
  "event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount)",
  "event RewardPaid(address indexed user, uint256 indexed pid, uint256 amount)",
  "event PoolAdded(uint256 indexed pid, address stakingToken, address rewardToken, uint256 rewardPerBlock)",
  "event RewardPerBlockUpdated(uint256 indexed pid, uint256 rewardPerBlock)",
  "event OwnershipTransferred(address indexed prevOwner, address indexed newOwner)",
];

// Multi-token Faucet contract
export const FAUCET_ABI = [
  "function adminWithdraw(uint8 tokenIndex, uint256 amount, address to)",
  "function claim(uint8 tokenIndex)",
  "function claimAll()",
  "function refill(uint8 tokenIndex, uint256 amount)",
  "function setClaimAmount(uint8 tokenIndex, uint256 amount)",
  "function setCooldown(uint256 seconds_)",
  "function setMaxClaims(uint8 tokenIndex, uint256 max)",
  "function setToken(uint8 tokenIndex, address tokenAddress)",
  "function setUserClaimCount(address user, uint8 tokenIndex, uint256 count)",
  "function claimAmounts(uint256) view returns (uint256)",
  "function cooldown() view returns (uint256)",
  "function lastClaimed(address, uint8) view returns (uint256)",
  "function maxClaims(uint256) view returns (uint256)",
  "function owner() view returns (address)",
  "function tokens(uint256) view returns (address)",
  "function userClaimCount(address, uint8) view returns (uint256)",
];
