/* eslint-disable no-undef */
module.exports = async function sign(message, address) {
  let signature = await web3.eth.sign(message, address);

  // some magic byte swapping shit for signature's v value, because no
  // personal_sign for you in ganache!
  signature =
    signature.substr(0, 130) + (signature.substr(130) === "00" ? "1b" : "1c");
  return signature;
};
