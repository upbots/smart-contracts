/* eslint-disable no-undef */
const {time, BN, expectRevert} = require("@openzeppelin/test-helpers"); // this installs require('chai').use(chaiBN);
const encodeCall = require("./helpers/encodeCall");

const timelock = artifacts.require("TimelockExtendable");
const ubxToken = artifacts.require("UbxToken");
const OwnedUpgradeabilityProxy = artifacts.require("OwnedUpgradeabilityProxy");

contract(
  "TokenTimelock",
  ([
    minter,
    beneficiary,
    owner,
    proxyOwner,
    tokenOwner,
    tokenPauser1,
    tokenPauser2,
  ]) => {
    const lockedAmount = new BN("1000");

    const deployToken = async (
      tmpProxyOwner,
      tmpTokenHolder,
      tmpTokenOwner,
      tmpTokenPauser1,
      tmpTokenPauser2
    ) => {
      const implV0 = await ubxToken.new();
      const proxy = await OwnedUpgradeabilityProxy.new({from: tmpProxyOwner});
      const initialSupply = new BN("500000000000000000000000000");
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
          tmpTokenHolder,
          tmpTokenOwner,
          [tmpTokenPauser1, tmpTokenPauser2],
        ]
      );

      // Initiliaze proxy with token address and call initialize function 'inittoken' that replace the constructor
      await proxy.initialize(implV0.address, tmpProxyOwner, initializeData, {
        from: tmpProxyOwner,
      });

      return ubxToken.at(proxy.address);
    };

    context("with token", () => {
      beforeEach(async () => {
        this.token = await deployToken(
          proxyOwner,
          minter,
          tokenOwner,
          tokenPauser1,
          tokenPauser2
        );
      });

      it("rejects a release time in the past", async () => {
        const pastReleaseTime = (await time.latest()).sub(
          time.duration.years(1)
        );
        const timeLockInstance = await timelock.new({from: minter});
        await expectRevert(
          timeLockInstance.initialize(
            this.token.address,
            beneficiary,
            pastReleaseTime,
            owner,
            {from: minter}
          ),
          "TokenTimelock: release time is before current time"
        );
      });

      context("once deployed (initialized) without token deposit", () => {
        beforeEach(async () => {
          this.releaseTime = (await time.latest()).add(time.duration.years(1));
          this.timelock = await timelock.new({from: minter});
          await this.timelock.initialize(
            this.token.address,
            beneficiary,
            this.releaseTime,
            owner,
            {from: minter}
          );
        });
        it("cannot be released if not deposit", async () => {
          await time.increaseTo(this.releaseTime.add(time.duration.hours(1))); // now release time has passed
          await expectRevert(
            this.timelock.release({from: owner}),
            "TokenTimelock: no tokens to release"
          );
        });
        it("cannot be releaseAndExtend if not deposit", async () => {
          const extendedTime = this.releaseTime.add(time.duration.hours(10));
          await time.increaseTo(this.releaseTime.add(time.duration.hours(1))); // now release time has passed
          await expectRevert(
            this.timelock.releaseAndExtend(extendedTime, {from: owner}),
            "TokenTimelock: no tokens to release"
          );
        });
      });

      context("once deployed (initialized) and some token locked", () => {
        beforeEach(async () => {
          this.releaseTime = (await time.latest()).add(time.duration.years(1));
          this.timelock = await timelock.new({from: minter});
          await this.timelock.initialize(
            this.token.address,
            beneficiary,
            this.releaseTime,
            owner,
            {from: minter}
          );

          // you lock tokens by transfering token to the timelock address
          await this.token.transfer(this.timelock.address, lockedAmount, {
            from: minter,
          }); // top up the locked token
        });

        it("can get state", async () => {
          expect(await this.timelock.token()).to.equal(this.token.address);
          expect(await this.timelock.beneficiary()).to.equal(beneficiary);
          const tl = await this.timelock.releaseTime();
          assert(tl.eq(this.releaseTime));
        });

        it("cannot be released before time limit", async () => {
          await expectRevert(
            this.timelock.release({from: owner}),
            "TokenTimelock: current time is before release time"
          );
        });
        it("cannot be releasedAndExtend before time limit", async () => {
          const extendedTime = this.releaseTime.add(time.duration.hours(1));
          await expectRevert(
            this.timelock.releaseAndExtend(extendedTime, {from: owner}),
            "TokenTimelock: current time is before release time"
          );
        });

        it("cannot be released just before time limit", async () => {
          await time.increaseTo(this.releaseTime.sub(time.duration.seconds(3)));
          await expectRevert(
            this.timelock.release({from: owner}),
            "TokenTimelock: current time is before release time"
          );
        });
        it("cannot be releasedAndExtend just before time limit", async () => {
          const extendedTime = this.releaseTime.add(time.duration.hours(1));
          await time.increaseTo(this.releaseTime.sub(time.duration.seconds(3)));
          await expectRevert(
            this.timelock.releaseAndExtend(extendedTime, {from: owner}),
            "TokenTimelock: current time is before release time"
          );
        });

        it("can be released just after limit", async () => {
          await time.increaseTo(this.releaseTime.add(time.duration.seconds(1)));
          await this.timelock.release({from: owner});
          const balance = await this.token.balanceOf(beneficiary);
          assert(balance.eq(lockedAmount));
        });
        it("can be releasedAndExtend just after limit and new release time is set", async () => {
          const extendedTime = this.releaseTime.add(time.duration.hours(1));
          await time.increaseTo(this.releaseTime.add(time.duration.seconds(1)));
          await this.timelock.releaseAndExtend(extendedTime, {from: owner}); // act
          let balance = await this.token.balanceOf(beneficiary);
          assert(balance.eq(lockedAmount));
          const tl = await this.timelock.releaseTime();
          // "new release time expected after releaseAndExtend"
          assert(tl.eq(extendedTime));

          // Second release denied
          await this.token.transfer(this.timelock.address, lockedAmount, {
            from: minter,
          }); // second top up
          balance = await this.token.balanceOf(beneficiary);
          assert(balance.eq(lockedAmount));
          await expectRevert(
            this.timelock.releaseAndExtend(extendedTime, {from: owner}),
            "TokenTimelock: current time is before release time"
          );
        });

        it("can be released after time limit", async () => {
          await time.increaseTo(this.releaseTime.add(time.duration.years(1)));
          await this.timelock.release({from: owner});
          const bal = await this.token.balanceOf(beneficiary);
          assert(bal.eq(lockedAmount));
        });
        it("can be releasedAndExtend after time limit", async () => {
          const extendedTime = this.releaseTime.add(time.duration.years(2));
          await time.increaseTo(this.releaseTime.add(time.duration.years(1)));
          await this.timelock.releaseAndExtend(extendedTime, {from: owner});
          const bal = await this.token.balanceOf(beneficiary);
          assert(bal.eq(lockedAmount));
          const tl = await this.timelock.releaseTime();
          //  "new release time expected after releaseAndExtend"
          assert(tl.eq(extendedTime));
        });

        it("cannot be releasedAndExtend if new release in the past", async () => {
          await time.increaseTo(this.releaseTime.add(time.duration.hours(1))); // now is release time
          const extendedTime = this.releaseTime.sub(time.duration.hours(1)); // is in the past
          await expectRevert(
            this.timelock.releaseAndExtend(extendedTime, {from: owner}),
            "TokenTimelock: release time is before current time"
          );
        });

        it("cannot be released twice", async () => {
          await time.increaseTo(this.releaseTime.add(time.duration.years(1)));
          await this.timelock.release({from: owner});
          await expectRevert(
            this.timelock.release({from: owner}),
            "TokenTimelock: no tokens to release"
          );
          const tl = await this.token.balanceOf(beneficiary);
          //  "new release time expected after releaseAndExtend"
          assert(tl.eq(lockedAmount));
        });
        it("can be released a second time if was extended", async () => {
          const extendedTime = this.releaseTime.add(time.duration.years(1));
          const extendedTime2 = extendedTime.add(time.duration.years(1));
          await time.increaseTo(this.releaseTime.add(time.duration.days(1))); // ...releaseTime passed
          await this.timelock.releaseAndExtend(extendedTime, {from: owner});
          let tl = await this.token.balanceOf(beneficiary);
          // beneficiary expects amount when fund was released
          assert(tl.eq(lockedAmount));

          // cannot be released a second time if extension is not yet passed
          await this.token.transfer(this.timelock.address, lockedAmount, {
            from: minter,
          }); // second top up
          await expectRevert(
            this.timelock.release({from: owner}),
            "TokenTimelock: current time is before release time"
          );
          await expectRevert(
            this.timelock.releaseAndExtend(extendedTime2, {from: owner}),
            "TokenTimelock: current time is before release time"
          );
          tl = await this.token.balanceOf(beneficiary);

          assert(tl.eq(lockedAmount));

          await time.increaseTo(extendedTime.add(time.duration.hours(1))); // ...extendedTime passed
          await this.timelock.releaseAndExtend(extendedTime2, {from: owner});
          tl = await this.token.balanceOf(beneficiary);
          // "beneficiary expects 2x amount when fund was released a second time"
          assert(tl.eq(new BN("2").mul(lockedAmount)));
          const rt = await this.timelock.releaseTime();
          // the new release time expected after releaseAndExtend twice
          assert(rt.eq(extendedTime2));
        });

        it("cannot be released if not owner", async () => {
          await time.increaseTo(this.releaseTime.add(time.duration.seconds(1)));
          // expects Ownable: caller is not the owner -- Reason given: Ownable: caller is not the owner
          await expectRevert(
            this.timelock.release({from: beneficiary}),
            "Ownable: caller is not the owner"
          );
          const balance = await this.token.balanceOf(beneficiary);
          assert(balance.eq(new BN("0")));
        });
        it("cannot be releasedAndExtend if not owner", async () => {
          await time.increaseTo(this.releaseTime.add(time.duration.seconds(1)));
          const extendedTime = this.releaseTime.add(time.duration.years(1));
          // expects Ownable: caller is not the owner -- Reason given: Ownable: caller is not the owner
          await expectRevert(
            this.timelock.releaseAndExtend(extendedTime, {from: beneficiary}),
            "Ownable: caller is not the owner"
          );
          const balance = await this.token.balanceOf(beneficiary);
          assert(balance.eq(new BN("0")));
        });
      });
    });
  }
);
