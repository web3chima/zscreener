export const chainConfig = {
  network: process.env.ZCASH_NETWORK || 'testnet',

  // Chain parameters
  consensus: {
    // Block heights for network upgrades
    overwinter: 207500,
    sapling: 280000,
    blossom: 653600,
    heartwood: 903000,
    canopy: 1046400,
    nu5: 1687104,
  },

  // Sync parameters
  sync: {
    batchSize: 50,
    pollInterval: 10000,
    rewindLimit: 100, // Max blocks to handle reorgs
  }
};

export default chainConfig;
