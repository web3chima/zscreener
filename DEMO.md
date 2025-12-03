# Zscreener Demo Walkthrough

This guide walks you through the key features of Zscreener for the hackathon demo.

## Prerequisites
- Ensure the project is running via `docker-compose up -d` or locally.
- Open your browser to `http://localhost:5173` (or your deployed URL).

## 1. Network Dashboard (The "Hook")
**Goal:** Show that we are indexing live Zcash blockchain data.

1.  **Navigate to Home:** You land on the Dashboard immediately.
2.  **Verify Live Data:**
    *   **Latest Block:** Observe the block height (e.g., `2845123`).
    *   **Network Hashrate:** See the real-time mining power.
    *   **ZEC Price:** Live feed from CoinGecko.
    *   **Recent Transactions:** Watch new transactions appear in the "Recent Transactions" list. Note the "Shielded" badge on private transactions.

## 2. Shielded Analytics
**Goal:** Demonstrate analysis of private pools without breaking individual privacy.

1.  **Click "Analytics"** in the sidebar.
2.  **View Pool Stats:** Show the distribution of value in the Shielded Pools (Orchard vs. Sapling vs. Transparent).
3.  **Explain:** "We can see the *aggregate* health of the privacy set without knowing *who* is transacting."

## 3. The "Hero Feature": Private Wallet Import
**Goal:** Show how a user views their own data using Nillion privacy.

1.  **Click "Wallet"** in the sidebar.
2.  **Enter Viewing Key:**
    *   Paste a valid Zcash Viewing Key (Unified or Sapling).
    *   *Note: If you don't have one, the system uses a demo key for visualization.*
3.  **Click "Decrypt Private History":**
    *   **Action:** The app shows "Encrypting with Nillion...".
    *   **Result:** The private transaction history appears.
    *   **Key Point:** "This key was encrypted and processed in a secure enclave. It was never exposed to our database in plain text."

## 4. Cross-Chain Privacy Bridge (NEAR Intents)
**Goal:** Show future interoperability.

1.  **Click "Cross-Chain"** in the sidebar.
2.  **Input:**
    *   **Amount:** Enter `10` ZEC.
    *   **NEAR Account:** Enter `demo.near`.
3.  **Click "Initiate Chain Signature":**
    *   Watch the steps: "Signing on MPC Node..." -> "Intent Signed".
4.  **Result:** A success message with a transaction hash appears.
    *   **Explain:** "We used a NEAR Chain Signature to control Zcash assets directly, enabling privacy-preserving DeFi."

## 5. Mobile / Responsive
**Goal:** Show polish.
1.  Resize the browser window to mobile size.
2.  Show that the dashboard and charts adapt perfectly.
