# AgentProcure AI 🤖

> **Decentralized Autonomous Vendor Selection** — powered by the Somnia Shannon Testnet.

AgentProcure AI is a fully on-chain procurement protocol that automates vendor evaluation using AI agents. Submit a procurement demand, let on-chain scraping agents parse vendor websites, and receive LLM-generated vendor recommendations — all without a centralized backend.

---

## 🌐 Live Network

| Property | Value |
|----------|-------|
| Network | Somnia Shannon Testnet |
| Chain ID | `50312` (`0xc488`) |
| Native Token | STT (Somnia Test Token) |
| RPC | `https://api.infra.testnet.somnia.network/` |
| Explorer | `https://explorer-v2.testnet.somnia.network/` |

---

## 🏗️ Architecture

```
User (MetaMask)
    │
    ▼
ProcurementStorage Contract          ← stores demand + vendor URLs
    │
    ├──► ParseWebsite Contract        ← triggers Somnia scraping agent (3.3 STT deposit)
    │         │
    │         └──► ParseCompleted / ParseFailed events
    │
    └──► AIRecommendation Contract    ← triggers Somnia LLM agent
              │
              └──► AnalysisCompleted event → Winner + Reason
```

### Smart Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| `ProcurementStorage` | `0x9199dA0FE01E7013c4AB37f228394827f95E1748` | Stores procurement requests, vendor URLs, and final evaluations |
| `ParseWebsite` | `0xA461Af31530bD2a1d8B8411F9bF070C29849eC85` | Triggers Somnia scraping agent to extract vendor page data |
| `AIRecommendation` | `0xE1e16C44A50D2A83d69FA6fd540d3dF3EF0520e7` | Triggers Somnia LLM agent to analyze vendors and pick a winner |

---

## 🔄 Procurement Workflow

1. **Create Request** — Submit a procurement demand with product name, budget (STT), and 3 vendor URLs
2. **Parse Websites** — Each vendor URL is sent to the on-chain scraping agent (costs **3.3 STT** per URL)
3. **AI Analysis** — All parsed vendor data is sent to the LLM agent for comparative evaluation
4. **Store Evaluation** — The final winner + scores are committed to the `ProcurementStorage` contract on-chain
5. **History** — All procurement records are readable directly from contract state

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Blockchain | ethers.js v6 |
| Wallet | MetaMask (EIP-1193) |
| Icons | Lucide React |
| Routing | React Router v7 |

---

## 📁 Project Structure

```
src/
├── contracts/
│   └── config.ts          # Contract addresses + ABIs
├── contexts/
│   └── Web3Context.tsx    # MetaMask wallet connection + provider
├── components/
│   └── Layout.tsx         # App shell, navigation
├── pages/
│   ├── Dashboard.tsx      # Overview metrics + recent requests
│   ├── CreateRequest.tsx  # Submit new procurement demand
│   ├── RequestDetails.tsx # Parse websites + AI analysis + evaluation
│   ├── History.tsx        # Full on-chain procurement history
│   └── AgentActivity.tsx  # Live agent monitoring
└── main.tsx
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MetaMask browser extension
- Somnia Shannon Testnet configured in MetaMask
- Some STT tokens (from the Somnia faucet)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd agentprocure

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### MetaMask Setup

Add the Somnia Shannon Testnet manually:

| Field | Value |
|-------|-------|
| Network Name | Somnia Shannon Testnet |
| RPC URL | `https://api.infra.testnet.somnia.network/` |
| Chain ID | `50312` |
| Symbol | `STT` |
| Explorer | `https://explorer-v2.testnet.somnia.network/` |

---

## 💡 Key Notes

- **Parsing deposit**: Each `parseWebsite()` call requires **3.3 STT** as the agent execution deposit. This is paid to the Somnia agent platform — not gas.
- **Block range limit**: The Somnia testnet RPC limits `eth_getLogs` queries to **1000 blocks**. The app handles this by either using a 900-block rolling window or reading directly from contract state mappings.
- **Agent completion time**: After submitting a parse or AI request, the Somnia agent takes time (typically 30s–3min) to process and call back with results. The UI polls every 8–10 seconds.
- **ParseFailed**: If the agent returns `ParseFailed`, it usually means the URL was inaccessible or the deposit was insufficient. Use the **Reset** button and retry.

---

## 📜 Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

---

## 📄 License

MIT — build freely on the Somnia Testnet.
