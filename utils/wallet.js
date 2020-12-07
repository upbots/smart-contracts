/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
const {exit} = require("process");
const Web3 = require("web3");
const config = require("../truffle-config");

const network = process.argv.slice(2)[0];
const prov = config.networks[network].provider();

const web3 = new Web3(prov);
const getBalances = async (addresses) => {
  const bal1 = await web3.eth.getBalance(addresses[0]);
  const bal2 = await web3.eth.getBalance(addresses[1]);
  const bal3 = await web3.eth.getBalance(addresses[2]);
  const bal4 = await web3.eth.getBalance(addresses[3]);
  const bal5 = await web3.eth.getBalance(addresses[4]);
  return [bal1, bal2, bal3, bal4, bal5];
};

getBalances(prov.addresses).then(async (balances) => {
  if (balances[0] < 200000000000000000) {
    console.error(
      `Balance of ${prov.addresses[0]} : ${balances[0]}/${web3.utils.fromWei(
        balances[0],
        "ether"
      )} ETH is insufficent you need at least 0.2 ether to deploy. Send ether to that address and start again.`
    );

    exit(-1);
  } else {
    console.log(
      `-----------Proxy Admin address: ${
        prov.addresses[0]
      } balance: ${web3.utils.fromWei(balances[0], "ether")} ETH`
    );
    console.log(
      `-----------Initial Token Holder address: ${
        prov.addresses[1]
      } balance: ${web3.utils.fromWei(balances[1], "ether")} ETH`
    );
    console.log(
      `-----------Initial Token Owner: ${
        prov.addresses[2]
      } balance: ${web3.utils.fromWei(balances[2], "ether")} ETH`
    );
    console.log(
      `-----------Pauser1: ${prov.addresses[3]} balance: ${web3.utils.fromWei(
        balances[3],
        "ether"
      )} ETH`
    );
    console.log(
      `-----------Pauser2: ${prov.addresses[4]} balance: ${web3.utils.fromWei(
        balances[4],
        "ether"
      )} ETH`
    );
    console.log(
      `
      `
    );
    exit(0);
  }
});
