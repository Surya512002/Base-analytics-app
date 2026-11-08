const { ethers } = require("hardhat");
const solc = require("solc");

const WRAPPER_FEED_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function version() external view returns (uint256);
    function getRoundData(uint80 _roundId) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
    function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

contract MockWrapperFeed is AggregatorV3Interface {
    AggregatorV3Interface public immutable realFeed;
    uint256 public multiplierNumerator;
    uint256 public multiplierDenominator;
    bool public forceFreshTimestamp;

    constructor(address realFeed_) {
        realFeed = AggregatorV3Interface(realFeed_);
        multiplierNumerator = 1;
        multiplierDenominator = 1;
        forceFreshTimestamp = true;
    }

    function setScale(uint256 num, uint256 den) external {
        require(den > 0, "den=0");
        multiplierNumerator = num;
        multiplierDenominator = den;
    }

    function setForceFreshTimestamp(bool fresh) external {
        forceFreshTimestamp = fresh;
    }

    function decimals() external view override returns (uint8) {
        return realFeed.decimals();
    }

    function description() external view override returns (string memory) {
        return realFeed.description();
    }

    function version() external view override returns (uint256) {
        return realFeed.version();
    }

    function getRoundData(uint80 _roundId) external view override returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) {
        (roundId, answer, startedAt, updatedAt, answeredInRound) = realFeed.getRoundData(_roundId);
        answer = int256((uint256(answer) * multiplierNumerator) / multiplierDenominator);
        if (forceFreshTimestamp) {
            updatedAt = block.timestamp;
        }
    }

    function latestRoundData() external view override returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) {
        (roundId, answer, startedAt, updatedAt, answeredInRound) = realFeed.latestRoundData();
        answer = int256((uint256(answer) * multiplierNumerator) / multiplierDenominator);
        if (forceFreshTimestamp) {
            updatedAt = block.timestamp;
        }
    }
}
`;

let cachedFactory = null;

async function getWrapperFeedFactory() {
  if (cachedFactory) return cachedFactory;

  const input = {
    language: "Solidity",
    sources: {
      "MockWrapperFeed.sol": { content: WRAPPER_FEED_SOURCE },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const errs = output.errors.filter((e) => e.severity === "error");
    if (errs.length > 0) throw new Error("Wrapper feed compile error: " + JSON.stringify(errs));
  }

  const contract = output.contracts["MockWrapperFeed.sol"]["MockWrapperFeed"];
  cachedFactory = new ethers.ContractFactory(contract.abi, contract.evm.bytecode.object);
  return cachedFactory;
}

module.exports = { getWrapperFeedFactory };
