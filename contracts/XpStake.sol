// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title XpStake — lock ETH on Base for referral fee boost tiers (7-day lock)
contract XpStake {
    struct StakeInfo {
        uint256 amount;
        uint64 unlockAt;
        uint8 tier; // 1 = 1.1x, 2 = 1.25x, 3 = 1.5x referrer boost
    }

    uint256 public constant LOCK_PERIOD = 7 days;
    uint256 public constant MIN_TIER1 = 0.0001 ether;
    uint256 public constant MIN_TIER2 = 0.0005 ether;
    uint256 public constant MIN_TIER3 = 0.001 ether;

    mapping(address => StakeInfo) public stakes;

    event Staked(address indexed user, uint256 amount, uint8 tier, uint64 unlockAt);
    event Unstaked(address indexed user, uint256 amount);

    function stake() external payable {
        require(msg.value >= MIN_TIER1, "min stake");
        uint8 tier = 1;
        if (msg.value >= MIN_TIER3) tier = 3;
        else if (msg.value >= MIN_TIER2) tier = 2;

        uint64 unlockAt = uint64(block.timestamp + LOCK_PERIOD);
        stakes[msg.sender] = StakeInfo({
            amount: msg.value,
            unlockAt: unlockAt,
            tier: tier
        });
        emit Staked(msg.sender, msg.value, tier, unlockAt);
    }

    function unstake() external {
        StakeInfo memory s = stakes[msg.sender];
        require(s.amount > 0, "no stake");
        require(block.timestamp >= s.unlockAt, "locked");
        delete stakes[msg.sender];
        (bool ok, ) = payable(msg.sender).call{value: s.amount}("");
        require(ok, "transfer failed");
        emit Unstaked(msg.sender, s.amount);
    }

    function getStake(address user)
        external
        view
        returns (uint256 amount, uint64 unlockAt, uint8 tier, bool active)
    {
        StakeInfo memory s = stakes[user];
        return (s.amount, s.unlockAt, s.tier, s.amount > 0);
    }
}
