#!/bin/bash
set -e

# Updated to match the path expected by the official zcashd image
CONF_DIR="/srv/zcashd/.zcash"
CONF_FILE="$CONF_DIR/zcash.conf"

echo "--- Zcashd Startup Script ---"
echo "Target Config File: $CONF_FILE"

# Ensure directory exists and is writable
mkdir -p "$CONF_DIR"
chmod 777 "$CONF_DIR"

# Function to create default config
create_config() {
    echo "Creating new zcash.conf..."
    echo "testnet=1" > "$CONF_FILE"
    echo "addnode=testnet.z.cash" >> "$CONF_FILE"
    echo "rpcuser=zcashrpc" >> "$CONF_FILE"
    echo "rpcpassword=password" >> "$CONF_FILE"
    echo "rpcport=18232" >> "$CONF_FILE"
    echo "rpcallowip=0.0.0.0/0" >> "$CONF_FILE"
    echo "txindex=1" >> "$CONF_FILE"
    echo "experimentalfeatures=1" >> "$CONF_FILE"
    echo "insightexplorer=1" >> "$CONF_FILE"
    # Low memory configuration for Railway Free Tier
    echo "dbcache=50" >> "$CONF_FILE"
    echo "maxconnections=8" >> "$CONF_FILE"
    echo "showmetrics=0" >> "$CONF_FILE"
    echo "printtoconsole=1" >> "$CONF_FILE"
}

# If config doesn't exist, create it
if [ ! -f "$CONF_FILE" ]; then
    create_config
else
    echo "Found existing config file."
fi

# Ensure deprecation warning is present (idempotent check)
if ! grep -q "i-am-aware-zcashd-will-be-replaced-by-zebrad-and-zallet-in-2025=1" "$CONF_FILE"; then
    echo "Adding deprecation acknowledgement to zcash.conf..."
    echo "" >> "$CONF_FILE" # Ensure new line
    echo "i-am-aware-zcashd-will-be-replaced-by-zebrad-and-zallet-in-2025=1" >> "$CONF_FILE"
else
    echo "Deprecation acknowledgement already present."
fi

echo "--- CURRENT CONFIG CONTENT ---"
cat "$CONF_FILE"
echo "------------------------------"

echo "Starting zcashd..."
# Execute zcashd directly
exec zcashd -printtoconsole -conf="$CONF_FILE" -datadir="$CONF_DIR"
