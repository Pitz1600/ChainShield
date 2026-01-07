const ChainShield = artifacts.require("ChainShield");

module.exports = function (deployer) {
  deployer.deploy(ChainShield);
};
