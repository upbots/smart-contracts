pragma solidity ^0.7.0;

import "./utils/wrapper/SafeERC20.sol";
import "./utils/Ownable.sol";
import "./utils/math/SafeMath.sol";
import "./utils/upgradeability/Initializable.sol";

/**
 * @title TokenRedeem
 * @dev A token holder contract that can release its token balance gradually
 *  with a block and redeem period. Optionally revocable by the owner.
 */
contract TokenRedeemUpgradeSafe is Initializable, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event TokensReleased(address token, uint256 amount);
    event TokenRedeemRevoked(address token);

    // beneficiary of tokens after they are released
    address private _beneficiary;

    // Durations and timestamps are expressed in UNIX time, the same units as block.timestamp.
    uint256 private _blockUntill;
    uint256 private _start;
    uint256 private _duration;

    bool private _revocable;

    mapping(address => uint256) private _released;
    mapping(address => bool) private _revoked;

    /**
     * @dev Creates a redeem contract with a balance of any ERC20 token to the
     * beneficiary, gradually in a linear fashion until start + duration. By then all
     * of the balance will have been redeemed.
     * @param beneficiary address of the beneficiary to whom tokens are transferred
     * @param blockDuration duration in seconds of the block in which tokens will begin to be redeemable
     * @param start the time (as Unix time) at which point redeem starts
     * @param duration duration in seconds of the period in which the tokens will be redeemable
     * @param revocable whether the redeem is revocable or not
     */

    function __TokenRedeem_init(
        address beneficiary,
        uint256 start,
        uint256 blockDuration,
        uint256 duration,
        bool revocable
    ) internal initializer {
        __TokenRedeem_init_unchained(
            beneficiary,
            start,
            blockDuration,
            duration,
            revocable
        );
    }

    function __TokenRedeem_init_unchained(
        address beneficiary,
        uint256 start,
        uint256 blockDuration,
        uint256 duration,
        bool revocable
    ) internal initializer {
        require(
            beneficiary != address(0),
            "TokenRedeem: beneficiary is the zero address"
        );
        // solhint-disable-next-line max-line-length
        require(
            blockDuration <= duration,
            "TokenRedeem: block is longer than duration"
        );
        require(duration > 0, "TokenRedeem: duration is 0");
        // solhint-disable-next-line max-line-length
        require(
            start.add(duration) > block.timestamp,
            "TokenRedeem: final time is before current time"
        );

        _beneficiary = beneficiary;
        _revocable = revocable;
        _duration = duration;
        _blockUntill = start.add(blockDuration);
        _start = start;
    }

    /**
     * @return the beneficiary of the tokens.
     */
    function beneficiary() public view returns (address) {
        return _beneficiary;
    }

    /**
     * @return the blockUntill time of the token redeem.
     */
    function blockUntill() public view returns (uint256) {
        return _blockUntill;
    }

    /**
     * @return the start time of the token redeem.
     */
    function start() public view returns (uint256) {
        return _start;
    }

    /**
     * @return the duration of the token redeem.
     */
    function duration() public view returns (uint256) {
        return _duration;
    }

    /**
     * @return true if the redeem is revocable.
     */
    function revocable() public view returns (bool) {
        return _revocable;
    }

    /**
     * @return the amount of the token released.
     */
    function released(address token) public view returns (uint256) {
        return _released[token];
    }

    /**
     * @return true if the token is revoked.
     */
    function revoked(address token) public view returns (bool) {
        return _revoked[token];
    }

    /**
     * @notice Transfers vested tokens to beneficiary.
     * @param token ERC20 token which is being vested
     */
    function release(IERC20 token) public {
        uint256 unreleased = _releasableAmount(token);

        require(unreleased > 0, "TokenRedeem: no tokens are due");

        _released[address(token)] = _released[address(token)].add(unreleased);

        token.safeTransfer(_beneficiary, unreleased);

        emit TokensReleased(address(token), unreleased);
    }

    /**
     * @notice Allows the owner to revoke the redeem. Tokens already vested
     * remain in the contract, the rest are returned to the owner.
     * @param token ERC20 token which is being vested
     */
    function revoke(IERC20 token) public onlyOwner {
        require(_revocable, "TokenRedeem: cannot revoke");
        require(
            !_revoked[address(token)],
            "TokenRedeem: token already revoked"
        );

        uint256 balance = token.balanceOf(address(this));

        uint256 unreleased = _releasableAmount(token);
        uint256 refund = balance.sub(unreleased);

        _revoked[address(token)] = true;

        token.safeTransfer(owner(), refund);

        emit TokenRedeemRevoked(address(token));
    }

    /**
     * @dev Calculates the amount that has already vested but hasn't been released yet.
     * @param token ERC20 token which is being vested
     */
    function _releasableAmount(IERC20 token) private view returns (uint256) {
        return _vestedAmount(token).sub(_released[address(token)]);
    }

    /**
     * @dev Calculates the amount that has already vested.
     * @param token ERC20 token which is being vested
     */
    function _vestedAmount(IERC20 token) private view returns (uint256) {
        uint256 currentBalance = token.balanceOf(address(this));
        uint256 totalBalance = currentBalance.add(_released[address(token)]);

        if (block.timestamp < _blockUntill) {
            return 0;
        } else if (
            block.timestamp >= _start.add(_duration) || _revoked[address(token)]
        ) {
            return totalBalance;
        } else {
            return totalBalance.mul(block.timestamp.sub(_start)).div(_duration);
        }
    }

    uint256[44] private __gap;
}
