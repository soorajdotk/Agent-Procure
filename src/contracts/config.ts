export const PROCUREMENT_STORAGE_ADDRESS = "0x9199dA0FE01E7013c4AB37f228394827f95E1748";
export const PARSE_WEBSITE_ADDRESS = "0xA461Af31530bD2a1d8B8411F9bF070C29849eC85";
export const AI_RECOMMENDATION_ADDRESS = "0xE1e16C44A50D2A83d69FA6fd540d3dF3EF0520e7";

export const SOMNIA_TESTNET_CONFIG = {
  chainId: "0xc488", // 50312 in hex
  chainName: "Somnia Shannon Testnet",
  nativeCurrency: {
    name: "Somnia Test Token",
    symbol: "STT",
    decimals: 18,
  },
  rpcUrls: ["https://api.infra.testnet.somnia.network/"],
  blockExplorerUrls: ["https://explorer-v2.testnet.somnia.network/"],
};

export const PROCUREMENT_STORAGE_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "vendorName", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "score", "type": "uint256" }
    ],
    "name": "EvaluationStored",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "requester", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "productName", "type": "string" }
    ],
    "name": "ProcurementCreated",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "requestId", "type": "uint256" },
      { "internalType": "string", "name": "vendorName", "type": "string" },
      { "internalType": "uint256", "name": "priceScore", "type": "uint256" },
      { "internalType": "uint256", "name": "qualityScore", "type": "uint256" },
      { "internalType": "uint256", "name": "reliabilityScore", "type": "uint256" },
      { "internalType": "uint256", "name": "overallScore", "type": "uint256" },
      { "internalType": "string", "name": "recommendation", "type": "string" }
    ],
    "name": "storeEvaluation",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "productName", "type": "string" },
      { "internalType": "uint256", "name": "budget", "type": "uint256" },
      { "internalType": "string[]", "name": "vendorUrls", "type": "string[]" }
    ],
    "name": "submitRequest",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "evaluations",
    "outputs": [
      { "internalType": "string", "name": "vendorName", "type": "string" },
      { "internalType": "uint256", "name": "priceScore", "type": "uint256" },
      { "internalType": "uint256", "name": "qualityScore", "type": "uint256" },
      { "internalType": "uint256", "name": "reliabilityScore", "type": "uint256" },
      { "internalType": "uint256", "name": "overallScore", "type": "uint256" },
      { "internalType": "string", "name": "recommendation", "type": "string" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "requestId", "type": "uint256" }
    ],
    "name": "getVendorUrls",
    "outputs": [
      { "internalType": "string[]", "name": "", "type": "string[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "requestCounter",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "requests",
    "outputs": [
      { "internalType": "uint256", "name": "id", "type": "uint256" },
      { "internalType": "address", "name": "requester", "type": "address" },
      { "internalType": "string", "name": "productName", "type": "string" },
      { "internalType": "uint256", "name": "budget", "type": "uint256" },
      { "internalType": "bool", "name": "processed", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export const AI_RECOMMENDATION_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "recommendation", "type": "string" }
    ],
    "name": "AnalysisCompleted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256" }
    ],
    "name": "AnalysisRequested",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "vendorPrompt", "type": "string" }
    ],
    "name": "analyzeVendors",
    "outputs": [
      { "internalType": "uint256", "name": "requestId", "type": "uint256" }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getBalance",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRequiredDeposit",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "pendingRequests",
    "outputs": [
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "recommendations",
    "outputs": [
      { "internalType": "string", "name": "result", "type": "string" },
      { "internalType": "bool", "name": "completed", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export const PARSE_WEBSITE_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "result", "type": "string" }
    ],
    "name": "ParseCompleted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256" },
      { "indexed": false, "internalType": "uint8", "name": "status", "type": "uint8" }
    ],
    "name": "ParseFailed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "url", "type": "string" }
    ],
    "name": "ParseRequested",
    "type": "event"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "websiteUrl", "type": "string" }
    ],
    "name": "parseWebsite",
    "outputs": [
      { "internalType": "uint256", "name": "requestId", "type": "uint256" }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRequiredDeposit",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "requestId", "type": "uint256" }
    ],
    "name": "getResult",
    "outputs": [
      { "internalType": "string", "name": "", "type": "string" },
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "platform",
    "outputs": [
      { "internalType": "contract IAgentRequester", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "results",
    "outputs": [
      { "internalType": "string", "name": "url", "type": "string" },
      { "internalType": "string", "name": "result", "type": "string" },
      { "internalType": "bool", "name": "completed", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
