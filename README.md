# UpBots Smart Contracts

# UBXT ERC-20 Ethereum token

## This project uses:

- [Truffle v5](https://truffleframework.com/)
- [Ganache](https://truffleframework.com/ganache)
- [OpenZeppelin](https://github.com/OpenZeppelin/openzeppelin-solidity)

## Installation

1. Install dependencies.

```shell
$ yarn
```

## Commands:

```
Compile contracts:                  npx truffle compile
Migrate contracts:                  npx truffle migrate
Test contracts:                     npx truffle test
Run eslint:                         yarn run lint
Run ganache-cli and truffle test:   yarn run test
```

## remark on solidity 0.7.0 and vs-code

Solidity 0.7.0 is not (yet) supported by prettier vs-code plugin : [issues/221](https://github.com/prettier-solidity/prettier-plugin-solidity/issues/221).
Solidity files are ignored for now. If you need to enable this, remove the `.prettierignore` file.

## Deployment

### 1. generate private key

first you need a private key. To generate one you can

1. disconnect from internet
2. open the [BIP39-MnemonicCode.html](./utils/BIP39-MnemonicCode.html) file located in the utils folder in your browser preferably in incognito/private mode
3. select `24 words` and click on the `generate` button.
4. copy on the below field `BIP39 Mnemonic` the 24 words in a file named `.secret` at the root of this folder
5. run `node utils/wallet.js goerli` to display the addresses generated with your seed, change network name if necessary
6. send some ether to the first address (Admin address)
7. Note that the second address will be the Initial Holder, meaning that all the first minted token will be owned by that address. To modify the total supply edit migrations/1_initial_migration.js INITIAL_SUPPLY variable, note that you can also edit ERC20_NAME and ERC20_SYMBOL

### 2. Deploiement

#### 2.1. with docker compose

with docker we will start up the compilation of the contracts and the deploiement initiated by the Admin address. Note that all the first minted token will be allocated to the initial holder address.

run `docker-compose -f docker/docker-compose.yaml up --build`. To deploy to goerli network you can edit the env variable in the `docker/docker-compose.yaml` file.

#### 2.2. manually

you can deploy by running `npm i && npx truffle migrate --network production`. Note that the gasPrice is set to 50gwei. You can modify it by editing `truffle-config.js`.

## Objectives

Find the simplest ERC-20 compatible Ethereum smart-contract which posseses the following characteristics:

- [:heavy_check_mark:] transfer token
- [:heavy_check_mark:] pausable
- [:heavy_check_mark:] burnable
- [:heavy_check_mark:] allow deposit approval
- [:heavy_check_mark:] can receive ether
- [:heavy_check_mark:] can receive token
- [:heavy_check_mark:] upgradable
- [:x:] mint no external fonction can trigger a mint of token

# API

## transfer coins

**Contract**: UbxToken

**Function**: transfer(address recipient, uint256 amount) transferFrom(address sender, address recipient, uint256 amount)

**Args**:

```
recipient address of the recipient
sender address of the sender
amount total of token to be transfered
```

## pausable

**Contract**: UbxToken

**Function**: pause()

**Args**: (only admin can pause)

## burnable

allows token holders to destroy both their own tokens and those that they have an allowance for, in a way that can be recognized off-chain (via event analysis).

**Contract**: UbxToken

**Function**: burn(uint256 amount)

**Args**:
amount total of token to be burned

## Approval

let somebody spend a certain amount of your token
**Contract**: UbxToken

**Function**: approve(address spender, uint256 amount)

**Args**:

```
address spender : address that will be able to spend the token
amount : total of token that the spender can spend
```

**Function**: increaseAllowance(address spender, uint256 addedValue)

**Args**:

```
address spender : address that will be able to spend the token
uint256 addedValue : amount of token that will be added to the token that the spender can spend
```

**Function**: decreaseAllowance(address spender, uint256 substractedValue)
**Args**:
address spender : address that is able to spend the token
uint256 substractedValue : amount of token that will be substracted to the amount of token that the spender can already spend

## TimeLock

ability to prove some tokens are locked for a period of time

A token holder contract that will allow a beneficiary to extract the tokens after a given release time

**Contract**: TimelockExtendable

**Function**: initialize(IERC20 token, address beneficiary, uint256 releaseTime, address owner)

**Args**:

```
// ERC20 basic token contract being held
IERC20 private _token;

// beneficiary of tokens after they are released
address private _beneficiary;

// timestamp when token release is enabled
uint256 private _releaseTime;

// owner of the contract
address owner
```

**Function**: releaseAndExtend(uint256 newReleaseTime)

**Args**:

```
// timestamp when token release is enabled
uint256 newReleaseTime;
```

## Upgradable

**Contract**: OwnedUpgradeabilityProxy

**Function**: initialize(address \_logic, address \_admin, bytes memory \_data)

**Args**:

```
_logic address of the initial implementation
_admin Address of the proxy administrator.
_data Data to send as msg.data to the implementation to initialize the proxied contract.
It should include the signature and the parameters of the function to be called, as described in
https://solidity.readthedocs.io/en/v0.4.24/abi-spec.html#function-selector-and-argument-encoding.
This parameter is optional, if no data is given the initialization call to proxied contract will be skipped.
```

**Function**: upgradeTo(address newImplementation)

**Args**: newImplementation Address of the new implementation

## License

```
MIT License

Copyright (c) 2020 UpBots GmbH

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
