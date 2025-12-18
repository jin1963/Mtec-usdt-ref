// config.js — MTEC Auto-Stake (FINAL) for Bitget + MetaMask

window.NETWORK = {
  chainId: 56,
  chainIdHex: "0x38",
  chainName: "BNB Smart Chain",
  rpcUrls: ["https://bsc-dataseed.binance.org/"],
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  blockExplorerUrls: ["https://bscscan.com"]
};

window.ADDR = {
  CONTRACT: "0xaC222708698da5E9Fc75aeaaD75b29102C9bBA90",
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  MTEC: "0x2D36AC3c4D4484aC60dcE5f1D4d2B69A826F52A4"
};

window.DECIMALS = { USDT: 18, MTEC: 18 };

// Minimal ERC20 ABI
window.ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

// Contract ABI (จากที่คุณให้มา)
window.CONTRACT_ABI = [
  {"inputs":[{"internalType":"address","name":"_usdt","type":"address"},{"internalType":"address","name":"_mtec","type":"address"},{"internalType":"uint256","name":"_apyBP","type":"uint256"}],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"uint256","name":"packageId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"usdtIn","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"mtecPrincipal","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"stakeIndex","type":"uint256"}],"name":"BoughtAndAutoStaked","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"uint256","name":"stakeIndex","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"principalMTEC","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"rewardMTEC","type":"uint256"}],"name":"Claimed","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"EmergencyWithdraw","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnerUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"usdtIn","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"mtecOut","type":"uint256"},{"indexed":false,"internalType":"bool","name":"active","type":"bool"}],"name":"PackageSet","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"apyBP","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"lockSec","type":"uint256"},{"indexed":false,"internalType":"bool","name":"enabled","type":"bool"}],"name":"ParamsUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"address","name":"ref1","type":"address"}],"name":"ReferralBound","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"buyer","type":"address"},{"indexed":true,"internalType":"address","name":"ref","type":"address"},{"indexed":false,"internalType":"uint8","name":"level","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"usdtAmount","type":"uint256"}],"name":"ReferralPaid","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"ref1Bps","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"ref2Bps","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"ref3Bps","type":"uint256"}],"name":"ReferralRatesUpdated","type":"event"},
  {"inputs":[],"name":"BPS_DENOM","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"SECONDS_PER_YEAR","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"apyBasisPoints","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"packageId","type":"uint256"},{"internalType":"address","name":"ref","type":"address"}],"name":"buyPackage","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"canClaim","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"index","type":"uint256"}],"name":"claim","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"enabled","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getReferrers","outputs":[{"internalType":"address","name":"r1","type":"address"},{"internalType":"address","name":"r2","type":"address"},{"internalType":"address","name":"r3","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getStake","outputs":[{"internalType":"uint256","name":"principalMTEC","type":"uint256"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"bool","name":"claimed","type":"bool"},{"internalType":"uint256","name":"apyBPAtStake","type":"uint256"},{"internalType":"uint256","name":"lockAtStake","type":"uint256"},{"internalType":"uint256","name":"usdtPaid","type":"uint256"},{"internalType":"uint256","name":"usdtNet","type":"uint256"},{"internalType":"address","name":"ref1","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getStakeCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"lockDuration","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"mtec","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"packageCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"packages","outputs":[{"internalType":"uint256","name":"usdtIn","type":"uint256"},{"internalType":"uint256","name":"mtecOut","type":"uint256"},{"internalType":"bool","name":"active","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"pendingReward","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"ref1Bps","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"ref2Bps","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"ref3Bps","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"referrerOf","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"setOwner","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"uint256","name":"usdtIn","type":"uint256"},{"internalType":"uint256","name":"mtecOut","type":"uint256"},{"internalType":"bool","name":"active","type":"bool"}],"name":"setPackage","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_apyBP","type":"uint256"},{"internalType":"uint256","name":"_lockSec","type":"uint256"},{"internalType":"bool","name":"_enabled","type":"bool"}],"name":"setParams","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_ref1","type":"uint256"},{"internalType":"uint256","name":"_ref2","type":"uint256"},{"internalType":"uint256","name":"_ref3","type":"uint256"}],"name":"setReferralRates","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"usdt","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"to","type":"address"}],"name":"withdrawMTEC","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"to","type":"address"}],"name":"withdrawUSDT","outputs":[],"stateMutability":"nonpayable","type":"function"}
];
