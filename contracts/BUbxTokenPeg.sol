// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "./utils/upgradeability/Initializable.sol";
import "./utils/ERC20.sol";
import "./utils/ERC20Burnable.sol";
import "./utils/Ownable.sol";
import "./utils/reclaim/CanReclaimEther.sol";
import "./utils/reclaim/CanReclaimToken.sol";
import "./utils/cryptography/ECDSA.sol";

/**
 * @title BUbxTokenPeg
 */

contract BUbxTokenPeg is Initializable, Ownable, CanReclaimEther {
    using ECDSA for bytes32;

    mapping(address => bool) public validators;
    mapping(uint256 => bool) private _seenNonces;

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event ClaimValidated(address indexed binanceAddr, uint256 amount);

    function initialize(
        IERC20 token,
        address owner,
        address[] memory validators
    ) public initializer {
        require(
            validators.length > 0,
            "At least one validator should be defined"
        );

        Ownable._onInitialize(owner);

        for (uint256 i = 1; i < validators.length; ++i) {
            _addValidator(validators[i]);
        }
    }

    function addValidator(address validator) public onlyOwner {
        _addValidator(validator);
        emit ValidatorAdded(validator);
    }

    function removeValidator(address validator) public onlyOwner {
        _removeValidator(validator);
        emit ValidatorRemoved(validator);
    }

    function claim(
        address binanceAddr,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) external {
        require(!_seenNonces[nonce], "Claim already validated");

        _validate(binanceAddr, amount, nonce, signature);
        _seenNonces[nonce] = true;
        emit ClaimValidated(binanceAddr, amount);
    }

    function _validate(
        address binanceAddr,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) internal view {
        bytes32 hash = keccak256(abi.encodePacked(binanceAddr, amount, nonce));
        bytes32 messageHash = hash.toEthSignedMessageHash();
        address validator = messageHash.recover(signature);

        // TODO: check if hash compare should be implemented
        require(validators[validator], "Claim is not valid");
    }

    function _addValidator(address validator) internal {
        require(!validators[validator], "Validator already added");
        validators[validator] = true;
    }

    function _removeValidator(address validator) internal {
        require(validators[validator], "There is no such validator");
        validators[validator] = false;
    }
}
