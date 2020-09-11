function encodeCall(name, inputs, values) {
  // eslint-disable-next-line no-undef
  return web3.eth.abi.encodeFunctionCall(
    {
      name,
      type: "function",
      inputs,
    },
    values
  );
}
module.exports = encodeCall;
