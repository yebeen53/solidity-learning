import hre from "hardhat";
import { expect } from "chai";
import type { MyToken } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const mintingAmount = 100n;
const decimals = 18n;
const initialSupply = mintingAmount * 10n ** decimals;

describe("My Token", () => {
  let myTokenC: MyToken;
  let signers: HardhatEthersSigner[];

  beforeEach("should deploy", async () => {
    signers = await hre.ethers.getSigners();
    myTokenC = await hre.ethers.deployContract("MyToken", [
      "MyToken",
      "MT",
      decimals,
      mintingAmount,
    ]);
    await myTokenC.waitForDeployment();
  });

  describe("Basic state value check", () => {
    it("should return name", async () => {
      expect(await myTokenC.name()).equal("MyToken");
    });

    it("should return symbol", async () => {
      expect(await myTokenC.symbol()).equal("MT");
    });

    it("should return decimals", async () => {
      expect(await myTokenC.decimals()).equal(decimals);
    });

    it("should return 100 totalSupply", async () => {
      expect(await myTokenC.totalSupply()).equal(mintingAmount * 10n ** decimals);
    });
  });

  describe("Mint", () => {
    it("should return 100 MT balance for signer 0", async () => {
      const signer0 = signers[0];
      expect(await myTokenC.balanceOf(signer0)).equal(mintingAmount * 10n ** decimals);
    });
  });

  describe("Transfer", () => {
    it("should have 0.5MT", async () => {
      const signer1 = signers[1];
      const amount = hre.ethers.parseUnits("0.5", Number(decimals));
      await myTokenC.transfer(amount, signer1.address);
      expect(await myTokenC.balanceOf(signer1.address)).equal(amount);
      expect(await myTokenC.balanceOf(signers[0].address)).equal(initialSupply - amount);
      expect(await myTokenC.totalSupply()).equal(initialSupply);
    });

    it("should be reverted with insufficient balance error", async () => {
      const signer1 = signers[1];
      await expect(
        myTokenC.transfer(
          hre.ethers.parseUnits((mintingAmount + 1n).toString(), Number(decimals)),
          signer1.address
        )
      ).to.be.revertedWith("insufficient balance");
      expect(await myTokenC.balanceOf(signers[0].address)).equal(initialSupply);
      expect(await myTokenC.balanceOf(signer1.address)).equal(0);
      expect(await myTokenC.totalSupply()).equal(initialSupply);
    });
  });
});

