function getAccounts(accounts, web3Utils) {
  const proxyAdmin = accounts[0];
  const tokenHolder = accounts[1];
  const tokenOwner = accounts[2];
  const pauser1 = accounts[3];
  const pauser2 = accounts[4];
  const pausers = [pauser1, pauser2];
  const validator1 = accounts[5];
  const validator2 = accounts[6];
  const validators = [validator1, validator2];

  /**
   * Step 3 Transfers to holders
   * array of object ex :
   * {
   *   address: "0x7d4bf7054f5cfd1f15c4e7d680656f0faf840898",
   *   value: new web3Utils.BN(web3Utils.toWei("1231", "ether")),
   * }
   * We need value to be of type BN
   * If empty the step will be skipped
   */
  const holders = [];

  /**
   * Step 4 Transfer Token Ownership
   * add an addresse and launch migration script to update proxy admin
   * if blank the step will be skipped
   */
  const newTokenOwner = "";

  /**
   * Step 5 Transfer Proxy Ownership
   * add an addresse and launch migration script to update proxy admin
   * if blank the step will be skipped
   */
  const newProxyAdmin = "";

  /**
   * Optional: Transfer tokens from this account to BUbxTokenPeg
   * if empty it will use original tokenHolder account
   */
  const binanceTokenHolder = "";

  return {
    proxyAdmin,
    tokenHolder,
    tokenOwner,
    pausers,
    newTokenOwner,
    newProxyAdmin,
    holders,
    validators,
    binanceTokenHolder,
    binancePegOwner: tokenOwner,
  };
}
module.exports = getAccounts;
