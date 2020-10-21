/* eslint-disable no-undef */
const {BN, expectRevert} = require("@openzeppelin/test-helpers");
// this installs require('chai').use(chaiBN);
const tokenRedeem = artifacts.require("TokenRedeem");
const ubxToken = artifacts.require("UbxToken");
const timeHelper = require("./helpers/time.js");

contract(
  "TokenRedeem",
  ([, proxyOwner, tokenHolder, tokenOwner, tokenPauser1, tokenPauser2]) => {
    const lockedAmount = new BN("1000");
    const SECONDS_IN_DAY = 86400;
    const deployToken = async (
      tmpProxyOwner,
      tmpTokenHolder,
      tmpTokenOwner,
      tmpTokenPauser1,
      tmpTokenPauser2
    ) => {
      this.token = await ubxToken.new({
        from: tmpProxyOwner,
      });
      const initialSupply = new BN("500000000000000000000000000");
      console.log(`---------------------before initialize---:${initialSupply}`);
      // Initiliaze proxy with token address and call initialize function 'inittoken' that replace the constructor
      await this.token.methods[
        "initialize(string,string,uint8,uint256,address,address,address[])"
      ](
        "UpBots",
        "UBXT",
        18,
        web3.utils.toHex(initialSupply),
        tmpTokenHolder,
        tmpTokenOwner,
        [tmpTokenPauser1, tmpTokenPauser2],
        {
          from: tmpProxyOwner,
        }
      );
    };

    const deployRedeem = async (tmpProxyOwner, tmpTokenPauser1) => {
      const now = Math.round(new Date().getTime() / 1000);
      this.redeem = await tokenRedeem.new(
        tmpTokenPauser1,
        now,
        SECONDS_IN_DAY * 50,
        SECONDS_IN_DAY * 100,
        true,
        {
          from: tmpProxyOwner,
        }
      );
    };

    beforeEach(async () => {
      await deployToken(
        proxyOwner,
        tokenHolder,
        tokenOwner,
        tokenPauser1,
        tokenPauser2
      );
      await deployRedeem(proxyOwner, tokenPauser1);
      snapShot = await timeHelper.takeSnapshot();
      snapshotId = snapShot.result;
    });
    afterEach(async () => {
      await timeHelper.revertToSnapShot(snapshotId);
    });
    describe("admin", () => {
      it("rejects a release time in the past", async () => {
        // Second release denied
        await this.token.transfer(this.redeem.address, lockedAmount, {
          from: tokenHolder,
        });
        const curBalance = await this.token.balanceOf(this.redeem.address, {
          from: tokenHolder,
        });
        assert(curBalance.eq(new BN(lockedAmount)));

        const benef = await this.redeem.beneficiary();
        assert.equal(benef, tokenPauser1);

        const now = Math.round(new Date().getTime() / 1000);
        const duration = await this.redeem.duration();
        const tstart = await this.redeem.start();
        const blockUntill = await this.redeem.blockUntill();
        console.log(
          `----blockUntill:${blockUntill} -duration:${duration}  -tstart:${tstart} now:${now}`
        );
        let realeased = await this.redeem.released(this.token.address);
        assert(realeased.eq(new BN(0)));
        await expectRevert(
          this.redeem.release(this.token.address, {
            from: tokenPauser1,
          }),
          "TokenRedeem: no tokens are due"
        );

        await timeHelper.advanceTimeAndBlock(SECONDS_IN_DAY * 49);
        const blockNum = await web3.eth.getBlockNumber();
        const block = await web3.eth.getBlock(blockNum);
        console.log(`----blocktimestamp:${block.timestamp}  `);
        await expectRevert(
          this.redeem.release(this.token.address, {
            from: tokenPauser1,
          }),
          "TokenRedeem: no tokens are due"
        );
        await timeHelper.advanceTimeAndBlock(SECONDS_IN_DAY * 1);
        await this.redeem.release(this.token.address, {
          from: tokenPauser1,
        });
        realeased = await this.redeem.released(this.token.address);
        assert(realeased.eq(new BN(500)));
        await timeHelper.advanceTimeAndBlock(SECONDS_IN_DAY * 25);
        await this.redeem.release(this.token.address, {
          from: tokenPauser1,
        });
        realeased = await this.redeem.released(this.token.address);
        assert(realeased.eq(new BN(750)));

        await timeHelper.advanceTimeAndBlock(SECONDS_IN_DAY * 25);
        await this.redeem.release(this.token.address, {
          from: tokenPauser1,
        });
        realeased = await this.redeem.released(this.token.address);
        assert(realeased.eq(new BN(1000)));
      });
    });
  }
);
