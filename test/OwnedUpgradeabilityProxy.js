/* eslint-disable no-undef */
const ubxToken = artifacts.require("UbxToken");
const ubxTokenV1 = artifacts.require("UbxTokenV1");
const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");

const encodeCall = require("./helpers/encodeCall");

const OwnedUpgradeabilityProxy = artifacts.require("OwnedUpgradeabilityProxy");

contract(
  "OwnedUpgradeabilityProxy",
  ([
    proxyDeployer,
    tokenHolder,
    tokenOwner,
    tokenPauser1,
    tokenPauser2,
    proxyAdmin,
    anotherAccount,
  ]) => {
    let proxy;
    let implV0;
    let implV1;
    let tokenV0;
    let tokenV1;
    const initialSupply = web3.utils.toBN("500000000000000000000000000");
    const initializeData = encodeCall(
      "initialize",
      [
        {
          type: "string",
          name: "name",
        },
        {
          type: "string",
          name: "symbol",
        },
        {
          type: "uint8",
          name: "decimals",
        },
        {
          type: "uint256",
          name: "initialsupply",
        },
        {
          type: "address",
          name: "initialHolder",
        },
        {
          type: "address",
          name: "owner",
        },
        {
          type: "address[]",
          name: "pausers",
        },
      ],
      [
        "UpBots",
        "UBXT",
        18,
        web3.utils.toHex(initialSupply),
        tokenHolder,
        tokenOwner,
        [tokenPauser1, tokenPauser2],
      ]
    );
    const initializeDataV1 = encodeCall(
      "init2",
      [
        {
          type: "uint256",
          name: "initialsupply",
        },
      ],
      ["42"]
    );

    beforeEach(async () => {
      proxy = await OwnedUpgradeabilityProxy.new({from: proxyDeployer});
      implV0 = await ubxToken.new();
      implV1 = await ubxTokenV1.new();
      tokenV0 = await ubxToken.at(proxy.address);
      tokenV1 = await ubxTokenV1.at(proxy.address);
    });

    describe("admin", () => {
      beforeEach(async () => {
        // const imple = await proxy.implementation.call({from: proxyOwner});

        // Initiliaze proxy with token address and call initialize function 'inittoken' that replace the constructor
        await proxy.initialize(implV0.address, proxyAdmin, initializeData, {
          from: proxyDeployer,
        });
      });
      it("has an admin", async () => {
        const owner = await proxy.admin.call({from: proxyAdmin});
        assert.equal(owner, proxyAdmin);
      });
    });

    describe("transferOwnership", () => {
      describe("when the new proposed owner is not the zero address", () => {
        const newOwner = anotherAccount;
        beforeEach(async () => {
          // Initiliaze proxy with token address and call initialize function 'inittoken' that replace the constructor
          await proxy.initialize(implV0.address, proxyAdmin, initializeData, {
            from: proxyDeployer,
          });
        });
        describe("when the sender is the proxy Admin", () => {
          it("transfers the ownership", async () => {
            const curowner = await proxy.admin.call({from: proxyAdmin});
            assert.equal(curowner, proxyAdmin);
            await proxy.changeAdmin(newOwner, {from: proxyAdmin}); // transfer admin to newOwner(anotherAccount)

            const owner = await proxy.admin.call({from: newOwner});
            assert.equal(owner, newOwner);
          });

          it("emits an event", async () => {
            const receipt = await proxy.changeAdmin(newOwner, {
              from: proxyAdmin,
            });
            expectEvent(receipt, "AdminChanged", {
              previousAdmin: proxyAdmin,
              newAdmin: newOwner,
            });
          });
        });

        describe("when the sender is the token owner", () => {
          it("reverts", async () => {
            await proxy.upgradeTo(implV1.address, {
              from: proxyAdmin,
            });

            await expectRevert.unspecified(
              proxy.changeAdmin(anotherAccount, {from: tokenOwner})
            );
          });
        });

        describe("when the sender is not the owner", () => {
          it("reverts", async () => {
            await expectRevert.unspecified(
              proxy.changeAdmin(newOwner, {from: anotherAccount})
            );
          });
        });
      });

      describe("when the new proposed owner is the zero address", () => {
        const newOwner = constants.ZERO_ADDRESS;
        beforeEach(async () => {
          // Initiliaze proxy with token address and call initialize function 'inittoken' that replace the constructor
          proxy.initialize(implV0.address, proxyAdmin, initializeData, {
            from: proxyDeployer,
          });
        });
        it("reverts", async () => {
          await expectRevert(
            proxy.changeAdmin(newOwner, {from: proxyAdmin}),
            "no"
          );
        });
      });
    });

    describe("implementation", () => {
      describe("when an initial implementation was provided", () => {
        it("returns the given implementation", async () => {
          const rproxy = await OwnedUpgradeabilityProxy.new({
            from: proxyDeployer,
          });
          const rimplV0 = await ubxToken.new();
          const rimplV1 = await ubxTokenV1.new();

          // Initiliaze proxy with token address and call initialize function 'inittoken' that replace the constructor
          await rproxy.initialize(rimplV0.address, proxyAdmin, initializeData, {
            from: proxyDeployer,
          });
          // implementation1
          await rproxy.implementation.call({
            from: proxyAdmin,
          });

          await rproxy.upgradeTo(rimplV1.address, {from: proxyAdmin});
          const implementation2 = await rproxy.implementation.call({
            from: proxyAdmin,
          });
          expect(implementation2).equal(rimplV1.address);
        });
      });
    });

    describe("upgrade", () => {
      describe("when the new implementation is not the zero address", () => {
        describe("when the sender is the proxy owner", () => {
          describe("when no initial implementation was provided", () => {
            it("revert because no admin is defined ", async () => {
              const tmpProxy = await OwnedUpgradeabilityProxy.new();
              const tmpImplV0 = await ubxToken.new();

              await expectRevert(
                tmpProxy.upgradeTo(tmpImplV0.address, {from: proxyAdmin}),
                "Can't fallback if admin is not set"
              );
            });
          });

          describe("when an initial implementation was provided", () => {
            beforeEach(async () => {
              await proxy.initialize(
                implV0.address,
                proxyAdmin,
                initializeData,
                {
                  from: proxyDeployer,
                }
              );
            });

            describe("when the given implementation is equal to the current one", () => {
              it("reverts", async () => {
                await expectRevert(
                  proxy.upgradeTo(implV0.address, {from: proxyAdmin}),
                  "Proxy implementation is already set to this address"
                );
              });
            });

            describe("when the given implementation is different than the current one", () => {
              it("upgrades to the new implementation", async () => {
                await proxy.upgradeTo(implV1.address, {from: proxyAdmin});

                const implementation = await proxy.implementation.call({
                  from: proxyAdmin,
                });
                assert.equal(implementation, implV1.address);
              });
            });
          });
        });

        describe("when the sender is not the proxy owner", () => {
          it("reverts", async () => {
            await proxy.initialize(implV0.address, proxyAdmin, initializeData, {
              from: proxyDeployer,
            });
            await expectRevert.unspecified(
              proxy.upgradeTo(implV0.address, {from: anotherAccount})
            );
          });
        });
      });

      describe("when the new implementation is the zero address", () => {
        it("reverts", async () => {
          await proxy.initialize(implV0.address, proxyAdmin, initializeData, {
            from: proxyDeployer,
          });
          await expectRevert.unspecified(
            proxy.upgradeTo(constants.ZERO_ADDRESS, {
              from: proxyAdmin,
            })
          );
        });
      });
    });

    describe("upgrade and call", () => {
      describe("when the new implementation is not the zero address", () => {
        beforeEach(async () => {
          await proxy.initialize(implV0.address, proxyAdmin, initializeData, {
            from: proxyDeployer,
          });
          tot = await tokenV0.totalSupply({
            from: anotherAccount,
          });
        });
        describe("when the sender is the proxy owner", () => {
          const from = proxyAdmin;

          it("upgrades to the given implementation", async () => {
            adm = await proxy.admin.call({
              from,
            });

            ts0 = await tokenV0.totalSupply.call({from: anotherAccount});
            ts1 = await tokenV1.totalSupply.call({from: anotherAccount});
            assert(ts0.eq(ts1));
            await proxy.upgradeTo(implV1.address, {from});
            owner = await tokenV1.owner.call({
              from: anotherAccount,
            });

            t = await tokenV1.mint(anotherAccount, 100, {
              from: tokenOwner,
            });

            const burnReceipt = await tokenV1.burn(100, {
              from: anotherAccount,
            });
            tsburn = await tokenV1.totalSupply.call({
              from: anotherAccount,
            });
            assert.equal(parseInt(ts0, 10), parseInt(tsburn, 10));

            expectEvent(burnReceipt, "Transfer", {
              from: anotherAccount,
              to: constants.ZERO_ADDRESS,
              value: new BN(100),
            });

            const implV1Prime = await ubxTokenV1.new();
            yolo = await proxy.upgradeToAndCall(
              implV1Prime.address,
              initializeDataV1,
              {
                from,
              }
            );

            const implementation = await proxy.implementation.call({from});
            assert.equal(implementation, implV1Prime.address);
          });

          it("calls the implementation using the given data as msg.data", async () => {
            await proxy.upgradeToAndCall(implV1.address, initializeDataV1, {
              from,
            });
            // owner stays the same
            const owner = await tokenV1.owner.call({from: anotherAccount});
            assert.equal(owner, tokenOwner);

            totalBalance = await tokenV1.totalSupply.call({
              from: anotherAccount,
            });

            await expectRevert(
              tokenV1.mint(anotherAccount, 100, {from: anotherAccount}),
              "no"
            );

            const curBalance = await tokenV1.balanceOf(anotherAccount, {
              from: anotherAccount,
            });
            assert(curBalance.eq(new BN(0)));

            mintage = await tokenV1.mint(anotherAccount, "100", {
              from: tokenOwner,
            });

            newTotalBalance = await tokenV1.totalSupply.call({
              from: anotherAccount,
            });

            newBalance = await tokenV1.balanceOf(anotherAccount, {
              from: anotherAccount,
            });

            assert(newTotalBalance.eq(totalBalance.add(new BN(100))));
            assert(newBalance.eq(new BN(100)));
          });
        });

        describe("when the sender is not the proxy owner", () => {
          const from = anotherAccount;

          it("reverts", async () => {
            await expectRevert.unspecified(
              proxy.upgradeToAndCall(implV0.address, initializeData, {from})
            );
          });
        });
      });

      describe("when the new implementation is the zero address", () => {
        it("reverts", async () => {
          await proxy.initialize(implV0.address, proxyAdmin, initializeData, {
            from: proxyDeployer,
          });
          await expectRevert(
            proxy.upgradeToAndCall(constants.ZERO_ADDRESS, initializeData, {
              from: proxyAdmin,
            }),
            "Cannot set a proxy implementation to a non-contract address"
          );
        });
      });
    });

    describe("delegatecall", () => {
      describe("when no implementation was given", () => {
        it("reverts", async () => {
          const p = await OwnedUpgradeabilityProxy.new({
            from: proxyAdmin,
          });

          const t = await ubxToken.at(p.address);
          await expectRevert(
            t.totalSupply.call({from: anotherAccount}),
            "Can't fallback if admin is not set"
          );
        });
      });

      describe("when an initial implementation was given", () => {
        const sender = anotherAccount;

        beforeEach(async () => {
          proxy.initialize(implV0.address, proxyAdmin, initializeData, {
            from: proxyDeployer,
          });
        });

        describe("when there were no further upgrades", () => {
          it("delegates calls to the initial implementation", async () => {
            const totalSupplyBefore = await tokenV0.totalSupply();
            await tokenV0.transfer(sender, 100, {from: tokenHolder});

            const balance = await tokenV0.balanceOf(sender);
            assert(balance.eq(new BN(100)));

            const totalSupplyAfter = await tokenV0.totalSupply();
            assert(totalSupplyAfter.eq(totalSupplyBefore));
          });

          it("fails when trying to call an unknown function of the current implementation", async () => {
            await expectRevert.unspecified(
              tokenV1.mint(sender, 100, {from: tokenOwner})
            );
          });
        });

        describe("when there was another upgrade", () => {
          beforeEach(async () => {
            await proxy.upgradeTo(implV1.address, {from: proxyAdmin});
            await tokenV1.mint(sender, 100, {from: tokenOwner});
          });

          it("delegates calls to the last upgraded implementation", async () => {
            const totalSupplyBeforeMint = await tokenV1.totalSupply();
            await tokenV1.mint(sender, 20, {from: tokenOwner});
            const totalSupplyAfterMint = await tokenV1.totalSupply();
            assert(
              totalSupplyBeforeMint.eq(totalSupplyAfterMint.sub(new BN(20)))
            );
            // sender has 120 token
            await expectRevert(
              tokenV1.burnFrom(sender, 20, {from: sender}),
              "ERC20: burn amount exceeds allowance"
            );
            const receipt = await tokenV1.burnDouble(40, {from: sender});
            expectEvent(receipt, "BurnDouble", {
              burner: sender,
              value: new BN(80),
            });
            // sender has 40 token
            const balance = await tokenV1.balanceOf(sender);
            assert(balance.eq(new BN(40)));

            const totalSupply = await tokenV1.totalSupply();
            // const tot = new web3.utils.BN
            assert(totalSupply.eq(totalSupplyAfterMint.sub(new BN(80))));
          });
        });
      });
    });
  }
);
