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
      const signer0 = signers[0];
      const signer1 = signers[1];
      await expect(
        myTokenC.transfer(
          hre.ethers.parseUnits("0.5", decimals),
          signer1.address
        )
      )
        .to.emit(myTokenC, "Transfer")
        .withArgs(
          signer0.address,
          signer1.address,
          hre.ethers.parseUnits("0.5", decimals)
        );

      expect(await myTokenC.balanceOf(signer1.address)).equal(
        hre.ethers.parseUnits("0.5", decimals)
      );
      expect(await myTokenC.balanceOf(signer0.address)).equal(initialSupply - hre.ethers.parseUnits("0.5", decimals));
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

  describe("TransferFrom", () => {
    it("should transfer approved tokens and consume only the spent allowance", async () => {
      const [owner, spender, recipient] = signers;
      const approved = hre.ethers.parseUnits("10", decimals);
      const amount = hre.ethers.parseUnits("3", decimals);
      await myTokenC.approve(spender.address, approved);
      await expect(myTokenC.connect(spender).transferFrom(owner.address, recipient.address, amount))
        .to.emit(myTokenC, "Transfer").withArgs(owner.address, recipient.address, amount);
      expect(await myTokenC.allowance(owner.address, spender.address)).equal(approved - amount);
      expect(await myTokenC.balanceOf(owner.address)).equal(initialSupply - amount);
      expect(await myTokenC.balanceOf(recipient.address)).equal(amount);
      expect(await myTokenC.balanceOf(spender.address)).equal(0n);
      expect(await myTokenC.totalSupply()).equal(initialSupply);
    });

    it("should preserve state when the owner has insufficient balance", async () => {
      const [owner, spender, recipient] = signers;
      const amount = initialSupply + 1n;
      await myTokenC.approve(spender.address, amount);
      await expect(myTokenC.connect(spender).transferFrom(owner.address, recipient.address, amount))
        .to.be.revertedWith("insufficient balance");
      expect(await myTokenC.allowance(owner.address, spender.address)).equal(amount);
      expect(await myTokenC.balanceOf(owner.address)).equal(initialSupply);
      expect(await myTokenC.balanceOf(recipient.address)).equal(0n);
    });

    it("should reject spending beyond a nonzero allowance", async () => {
      const [owner, spender, recipient] = signers;
      await myTokenC.approve(spender.address, 1n);
      await expect(myTokenC.connect(spender).transferFrom(owner.address, recipient.address, 2n))
        .to.be.revertedWith("insufficient allowance");
      expect(await myTokenC.allowance(owner.address, spender.address)).equal(1n);
      expect(await myTokenC.balanceOf(owner.address)).equal(initialSupply);
      expect(await myTokenC.balanceOf(recipient.address)).equal(0n);
    });

    it("should isolate approvals by spender and allow replacement and revocation", async () => {
      const [owner, spender, other] = signers;
      await myTokenC.approve(spender.address, 10n);
      await expect(myTokenC.connect(other).transferFrom(owner.address, other.address, 1n))
        .to.be.revertedWith("insufficient allowance");
      await myTokenC.approve(spender.address, 4n);
      expect(await myTokenC.allowance(owner.address, spender.address)).equal(4n);
      await myTokenC.approve(spender.address, 0n);
      await expect(myTokenC.connect(spender).transferFrom(owner.address, other.address, 1n))
        .to.be.revertedWith("insufficient allowance");
    });

    it("should preserve balance on self transfers and allow zero transfers", async () => {
      const [owner, spender] = signers;
      await myTokenC.transfer(1n, owner.address);
      await myTokenC.approve(spender.address, 1n);
      await myTokenC.connect(spender).transferFrom(owner.address, owner.address, 1n);
      expect(await myTokenC.balanceOf(owner.address)).equal(initialSupply);
      expect(await myTokenC.allowance(owner.address, spender.address)).equal(0n);
      await expect(myTokenC.connect(spender).transferFrom(owner.address, spender.address, 0n))
        .to.emit(myTokenC, "Transfer").withArgs(owner.address, spender.address, 0n);
      expect(await myTokenC.totalSupply()).equal(initialSupply);
    });

    it("should reject zero-address recipients without consuming allowance", async () => {
      const [owner, spender] = signers;
      await expect(myTokenC.transfer(1n, hre.ethers.ZeroAddress)).to.be.revertedWith("invalid recipient");
      await myTokenC.approve(spender.address, 1n);
      await expect(myTokenC.connect(spender).transferFrom(owner.address, hre.ethers.ZeroAddress, 1n))
        .to.be.revertedWith("invalid recipient");
      expect(await myTokenC.allowance(owner.address, spender.address)).equal(1n);
      expect(await myTokenC.balanceOf(owner.address)).equal(initialSupply);
      expect(await myTokenC.balanceOf(hre.ethers.ZeroAddress)).equal(0n);
    });

    it("should emit Approval event", async () => {
      const signer1 = signers[1];
      await expect(
        myTokenC.approve(
          signer1.address,
          hre.ethers.parseUnits("10", decimals)
        )
      )
        .to.emit(myTokenC, "Approval")
        .withArgs(signer1.address, hre.ethers.parseUnits("10", decimals));
      expect(await myTokenC.allowance(signers[0].address, signer1.address)).equal(hre.ethers.parseUnits("10", decimals));
    });

    it("should be reverted with insufficient allowance error", async () => {
      const signer0 = signers[0];
      const signer1 = signers[1];
      await expect(
        myTokenC
          .connect(signer1)
          .transferFrom(
            signer0.address,
            signer1.address,
            hre.ethers.parseUnits("1", decimals)
          )
      ).to.be.revertedWith("insufficient allowance");
    });
  });
});

