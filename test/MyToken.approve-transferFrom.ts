import hre from "hardhat";
import { expect } from "chai";
import type { MyToken } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("My Token: signer1 transfers signer0 tokens with approval", () => {
  let myTokenC: MyToken;
  let signer0: HardhatEthersSigner;
  let signer1: HardhatEthersSigner;
  const decimals = 18n;
  const mintingAmount = 100n;

  beforeEach(async () => {
    [signer0, signer1] = await hre.ethers.getSigners();
    // 기존 MT 테스트와 동일하게 매 테스트마다 signer0이 새 계약을 배포한다.
    myTokenC = await hre.ethers.deployContract(
      "MyToken",
      ["MyToken", "MT", decimals, mintingAmount]
    );
    await myTokenC.waitForDeployment();
  });

  // signer0의 승인 후 signer1이 10 MT를 자신에게 옮기고 양쪽 잔액을 확인한다.
  it("should let signer1 transfer 10 MT from signer0 to itself after approval and verify both balances", async () => {
    const amount = hre.ethers.parseUnits("10", decimals);
    const signer0Before = await myTokenC.balanceOf(signer0.address);
    const signer1Before = await myTokenC.balanceOf(signer1.address);
    expect(signer0Before).to.be.gte(amount);
    expect(await myTokenC.allowance(signer0.address, signer1.address)).equal(0n);

    // signer0이 signer1에게 전송할 수량만큼 승인하고, 저장된 허용량을 검증한다.
    const approveTx = await myTokenC.connect(signer0).approve(signer1.address, amount);
    const approveReceipt = await approveTx.wait();
    expect(approveTx.from).equal(signer0.address);
    expect(approveReceipt?.status).equal(1);
    expect(await myTokenC.allowance(signer0.address, signer1.address)).equal(amount);
    expect(await myTokenC.balanceOf(signer0.address)).equal(signer0Before);
    expect(await myTokenC.balanceOf(signer1.address)).equal(signer1Before);

    // 반드시 signer1이 호출하여 signer0의 토큰을 signer1 자신의 주소로 전송한다.
    const transferTx = await myTokenC.connect(signer1).transferFrom(
      signer0.address,
      signer1.address,
      amount
    );
    const transferReceipt = await transferTx.wait();
    expect(transferTx.from).equal(signer1.address);
    expect(transferReceipt?.status).equal(1);
    await expect(transferTx)
      .to.emit(myTokenC, "Transfer")
      .withArgs(signer0.address, signer1.address, amount);

    // 전송 전후 두 계정의 잔액과 전액 사용 후 남은 허용량을 자동 검증한다.
    const signer0After = await myTokenC.balanceOf(signer0.address);
    const signer1After = await myTokenC.balanceOf(signer1.address);
    expect(signer0After).equal(signer0Before - amount);
    expect(signer1After).equal(signer1Before + amount);
    expect(await myTokenC.allowance(signer0.address, signer1.address)).equal(0n);
    expect(await myTokenC.totalSupply()).equal(mintingAmount * 10n ** decimals);
  });
});
