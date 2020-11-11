// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "./utils/wrapper/SafeERC20.sol";
import "./utils/upgradeability//Initializable.sol";
import "./utils/Ownable.sol";

/**
 * @dev A token holder contract that will allow a beneficiary to extract the
 * tokens after a given release time.
 *
 * Useful for simple vesting schedules like "advisors get all of their tokens
 * after 1 year".
 *
 * For a more complete vesting schedule, see {TokenVesting}.
 */
contract TimelockExtendable is Initializable, Ownable {
    using SafeERC20 for IERC20;

    /// ERC20 basic token contract being held
    IERC20 public token;

    /// Beneficiary of tokens after they are released
    address public beneficiary;

    /// Timestamp when token release is enabled
    uint256 public releaseTime;

    function initialize(
        IERC20 _token,
        address _beneficiary,
        uint256 _releaseTime,
        address _owner
    ) public initializer {
        require(
            _releaseTime > block.timestamp,
            "TokenTimelock: release time is before current time"
        );
        token = _token;
        beneficiary = _beneficiary;
        releaseTime = _releaseTime;
        //init the owner
        Ownable._onInitialize(_owner);
    }

    /**
     * @notice Transfers tokens held by timelock to beneficiary.
     */
    function release() public virtual onlyOwner {
        _release();
    }

    function releaseAndExtend(uint256 _newReleaseTime) public virtual onlyOwner {
        require(
            _newReleaseTime > block.timestamp,
            "TokenTimelock: release time is before current time"
        );
        _release();
        releaseTime = _newReleaseTime;
    }

    function _release() private {
        // solhint-disable-next-line not-rely-on-time
        require(
            block.timestamp >= releaseTime,
            "TokenTimelock: current time is before release time"
        );

        uint256 amount = token.balanceOf(address(this));
        require(amount > 0, "TokenTimelock: no tokens to release");

        token.safeTransfer(beneficiary, amount);
    }
}
