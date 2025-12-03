# Zcash Node Deployment Guide

## 1. Running a Zcash Node (The "Way Out")

Since shared RPC nodes (NOWNodes, GetBlock) do not support the private wallet features required by Zscreener (specifically `z_importviewingkey`), you must run your own Zcash node.

### Option A: Docker Compose (Local Development)

The easiest way to run the full stack, including the node:

```bash
docker-compose up -d
```

This will start:
1.  **zcash-node**: A `zcashd` node on Testnet (syncs faster than Mainnet).
2.  **backend**: The Zscreener API.
3.  **frontend**: The UI.
4.  **redis**: For queues/cache.

*Note: The node will take time to sync Testnet (several GBs).*

### Option B: Deploying on Railway

To deploy on Railway, you need to deploy the Zcash Node as a separate service.

1.  **Create a New Service** in your Railway project.
2.  **Source:** Select "Dockerfile".
3.  **Dockerfile Path:** Point it to `Dockerfile.zcashd` in this repo.
4.  **Variables:**
    *   Expose port `18232`.
5.  **Connect Backend:**
    *   In your Backend service variables, set `ZCASH_RPC_URL` to the internal Railway URL of your Zcash service (e.g., `http://zcash-node.railway.internal:18232`).
    *   Set `ZCASH_RPC_USER` to `zcashrpc` and `ZCASH_RPC_PASSWORD` to `password`.

## 2. Using NOWNodes (Limited Functionality)

If you strictly cannot run a node, you can use NOWNodes, but **wallet tracking will be disabled**.

1.  Set `ZCASH_RPC_URL=https://zec.nownodes.io/YOUR_API_KEY` in `.env`.
2.  The app will detect this is a shared node and will log a warning when you try to import a key.
3.  Features like "Live Hashrate" and "Pool Size" will still work!
4.  Transaction history for your viewing key will **not** update automatically.

## 3. Speeding Up Sync (Regtest)

For a hackathon demo where you need *instant* results and don't care about real Testnet data:

1.  Edit `Dockerfile.zcashd`:
    *   Change `echo "testnet=1"` to `echo "regtest=1"`.
    *   Change `rpcport=18232` to `rpcport=18443`.
2.  Update `docker-compose.yml` or `.env` to use port `18443`.
3.  Regtest is a private local network. You can generate blocks instantly using `zcash-cli generate 1`.

---
**Recommendation for Submission:** Use **Option A** (Docker Compose) locally for the demo video/testing to show full functionality. If deploying to Railway, use **Option B**.
