// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IClaimGate — pluggable onchain rule for BaseDrops.
/// @notice A drop can point at one gate. BaseDrops calls `configure` once when the drop is
///         created (so the gate can store per-drop settings) and `check` on every claim.
///         Gates are separate contracts so new rules ship without touching the escrow.
///
/// Rules for gate authors
///  - `check` must be `view`. BaseDrops calls it with STATICCALL, so it can't change state.
///  - `configure` must only accept calls from the BaseDrops contract that owns the drop, and
///    key its storage by (msg.sender, dropId).
///  - Revert or return false to refuse a claim. Never return true by default for unknown drops.
interface IClaimGate {
    /// @param dropId the drop being created
    /// @param config gate-specific settings chosen by the creator (ABI-encoded)
    function configure(uint256 dropId, bytes calldata config) external;

    /// @param dropId  the drop being claimed
    /// @param claimer the wallet claiming
    /// @param data    optional per-claim data supplied by the claimer (e.g. a proof)
    /// @return ok     true if `claimer` passes this rule right now
    function check(uint256 dropId, address claimer, bytes calldata data) external view returns (bool ok);
}
