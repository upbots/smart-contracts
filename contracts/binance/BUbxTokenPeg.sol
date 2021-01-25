// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "../utils/upgradeability/Initializable.sol";
import "../utils/ERC20.sol";
import "../utils/Ownable.sol";
import "../utils/reclaim/CanReclaimEther.sol";
import "../utils/cryptography/ECDSA.sol";

/**
 * @title BUbxTokenPeg
 */

contract BUbxTokenPeg is Initializable, Ownable, CanReclaimEther {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    mapping(address => bool) private _validators;
    mapping(uint256 => bool) private _seenNonces;
    IERC20 private _token;

    enum Actions {Claim, Waive}

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event ActionApproved(
        address indexed account,
        address indexed validator,
        uint256 amount,
        Actions action
    );

    function initialize(
        IERC20 token,
        address owner,
        address[] memory validators
    ) public initializer {
        require(validators.length > 0, "At least one validator should be defined");

        Ownable._onInitialize(owner);

        for (uint256 i = 0; i < validators.length; ++i) {
            _addValidator(validators[i]);
        }

        _token = token;
    }

    function addValidator(address validator) public onlyOwner {
        _addValidator(validator);
        emit ValidatorAdded(validator);
    }

    function removeValidator(address validator) public onlyOwner {
        _removeValidator(validator);
        emit ValidatorRemoved(validator);
    }

    modifier balancing(
        Actions action,
        address account,
        uint256 amount,
        uint256 nonce,
        bytes memory signature
    ) {
        require(!_seenNonces[nonce], "Action already approved");
        require((msg.sender == account), "Account and sender mismatch");

        address validator = _validate(account, amount, nonce, signature);
        _;
        _seenNonces[nonce] = true;

        emit ActionApproved(account, validator, amount, action);
    }

    function claim(
        address account,
        uint256 amount,
        uint256 nonce,
        bytes memory signature
    ) public balancing(Actions.Claim, account, amount, nonce, signature) {
        require(_token.balanceOf(address(this)) >= amount, "Claim exceeds liquidity");

        _token.safeTransfer(msg.sender, amount);
    }

    function waive(
        address account,
        uint256 amount,
        uint256 nonce,
        bytes memory signature
    ) public balancing(Actions.Waive, account, amount, nonce, signature) {
        _token.transferFrom(msg.sender, address(this), amount);
    }

    function _validate(
        address account,
        uint256 amount,
        uint256 nonce,
        bytes memory signature
    ) internal view returns (address) {
        bytes32 hash = keccak256(abi.encodePacked(account, amount, nonce));
        bytes32 messageHash = hash.toEthSignedMessageHash();
        address validator = messageHash.recover(signature);

        require(_validators[validator], "Action is not valid");
        return validator;
    }

    function _addValidator(address validator) internal {
        require(!_validators[validator], "Validator already added");
        _validators[validator] = true;
    }

    function _removeValidator(address validator) internal {
        require(_validators[validator], "There is no such validator");
        _validators[validator] = false;
    }
}
