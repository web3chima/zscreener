# Zscreener

**The Advanced Zcash Privacy Explorer & Cross-Chain Analytics Platform**

---

## 💡 Inspiration
Privacy is the fundamental right of the digital age, but it often comes at the cost of transparency and usability. Users are forced to choose between completely opaque "black boxes" or fully transparent public ledgers.

We built **Zscreener** to bridge this gap. We wanted to create a tool that respects user privacy while providing the rich analytics, compliance tools, and cross-chain interoperability that modern DeFi users expect. By combining **Zcash's** best-in-class shielding with **Nillion's** blind computation and **NEAR's** chain signatures, we unlock a new paradigm: **Privacy you can verify, Assets you can use anywhere.**

## 🚀 What It Does
Zscreener is a comprehensive privacy platform with three core pillars:

1.  **Shielded Analytics:** A real-time block explorer that provides insights into Zcash's shielded pools (Sapling/Orchard) without compromising individual sender/receiver anonymity.
2.  **Private Compliance:** Users can securely import their **Viewing Keys**. These keys are encrypted using **Nillion**, allowing the platform to decrypt and display transaction history *only* for the owner, without the server ever seeing the raw key.
3.  **Cross-Chain DeFi:** Utilizing **NEAR Intents** and Chain Signatures, users can manage Zcash assets and execute intents from other chains, effectively making Zcash the "Privacy Layer" for the broader crypto ecosystem.

## 🛠 How We Built It
We architected a robust monorepo to handle real-time blockchain indexing and secure compute:

*   **Frontend:** React 18, TypeScript, TailwindCSS, and Recharts for beautiful, responsive visualization.
*   **Backend:** Node.js/Express with a custom **Zcash Indexer** that connects directly to a `zcashd` node via RPC.
*   **Privacy Layer:**
    *   **Zcash:** We parse raw blocks to identify shielded outputs and value flows.
    *   **Nillion:** We use Nillion's Secret Vault to store and process Viewing Keys, ensuring we never hold user secrets.
*   **Interoperability:**
    *   **NEAR Protocol:** Implemented Chain Signatures to sign Zcash transactions via MPC nodes.

## 🚧 Challenges We Ran Into
*   **The "Heavy Node" Problem:** Running a full Zcash node is resource-intensive. We optimized our Docker setup to run a pruned Testnet node that balances performance with storage constraints, ensuring the indexer stays in sync.
*   **Privacy vs. Utility:** Parsing Zcash transactions is complex. Distinguishing between value entering and leaving the shielded pool required deep diving into ZIP specs (ZIP-221, ZIP-222).
*   **Secure Enclaves:** Integrating Nillion required a shift in thinking—moving logic from "server-side" to "blind-computation-side."

## 🏆 Accomplishments That We're Proud Of
*   **Live Indexing:** We aren't just showing mock data. Our backend connects to a live Zcash node and streams real blocks.
*   **Seamless UX:** We turned complex cryptography into a friendly dashboard that anyone can understand.
*   **Hybrid Architecture:** Successfully bridging the gap between a UTXO chain (Zcash) and account-based models (NEAR) using Intents.

---

## 💻 Getting Started

### Prerequisites
*   Docker & Docker Compose (Recommended)
*   Node.js v18+ (If running locally without Docker)

### The "Happy Path" (Docker)
The easiest way to see the full platform in action:

```bash
# 1. Clone the repo
git clone https://github.com/web3chima/zscreener.git
cd zscreener

# 2. Start the stack
docker-compose up -d
```
*Wait a few minutes for the Zcash node to initialize.* Access the app at **http://localhost:5173**.

### Manual Setup (Local Dev)
If you prefer running services individually:

1.  **Configure Environment:**
    The repository comes with pre-filled `.env.example` files ready for the hackathon context.
    ```bash
    cp packages/backend/.env.example packages/backend/.env
    cp packages/frontend/.env.example packages/frontend/.env
    ```
    *Important:* If you are deploying the frontend separately (e.g., on Vercel), ensure `VITE_API_URL` is set to your deployed Backend URL (e.g., `https://<your-railway-app>.up.railway.app/api`).

2.  **Install & Run:**
    ```bash
    npm install
    npm run dev
    ```
    *   Frontend: http://localhost:5173
    *   Backend: http://localhost:3000

## 📂 Project Structure
```
zscreener/
├── packages/
│   ├── frontend/     # React Dashboard & Analytics
│   ├── backend/      # Zcash Indexer & API
│   └── sdk/          # Developer SDK
├── docker-compose.yml
└── DEMO.md           # Step-by-step guide for judges
```

## 🔮 What's Next for Zscreener
*   **Mainnet Launch:** Moving from Testnet to Zcash Mainnet.
*   **ZSA Support:** Full support for Zcash Shielded Assets (Tokens on Zcash).
*   **Mobile App:** A React Native version for privacy on the go.

## 📜 License
MIT
