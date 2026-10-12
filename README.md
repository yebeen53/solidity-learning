# MT Token — approve & transferFrom 과제

**과제명: signer1번에 의한 signer0번 자산 이동 (approve & transferFrom)**

signer0이 signer1에게 MT 토큰 이동 권한을 부여하고, signer1이 그 권한으로 signer0의 토큰을 자신의 주소로 전송하는 과정을 자동 테스트합니다.

## 주요 파일

| 파일 | 내용 |
| --- | --- |
| [contracts/MyToken.sol](contracts/MyToken.sol) | MT 토큰 발행, 전송, 승인 및 위임 전송 구현 |
| [test/MyToken.approve-transferFrom.ts](test/MyToken.approve-transferFrom.ts) | 과제 전용 테스트: 승인 → signer1의 위임 전송 → 양쪽 잔액 검증 |
| [test/MyToken.ts](test/MyToken.ts) | 기본 상태, 발행, 이벤트, 전송 및 예외 상황 테스트 |
| [hardhat.config.ts](hardhat.config.ts) | Solidity 컴파일러 및 Hardhat 설정 |

## 실행 환경 및 설치

검증 환경: Node.js **20.19.4**, npm **10.8.2**, Hardhat **2.22.19**, ethers.js **6.17.0**, Solidity **0.8.28**.

저장소를 받은 뒤 프로젝트 루트에서 의존성을 설치합니다.

```shell
npm ci
```

테스트는 Hardhat의 로컬 테스트 네트워크에서 실행됩니다. 별도 노드 실행, 지갑 개인키 또는 실제 토큰이 필요하지 않습니다. 최초 컴파일 시 컴파일러 다운로드를 위한 인터넷 연결이 필요할 수 있습니다.

## 테스트 실행

과제 테스트만 실행:

```shell
npx hardhat test test/MyToken.approve-transferFrom.ts
```

기존 테스트를 포함한 전체 테스트 실행:

```shell
npm test
```

컴파일 및 TypeScript 타입 검사:

```shell
npm run typecheck
```

검증 결과: 과제 테스트 **1 passing**, 전체 테스트 **25 passing**, 타입 검사 통과. 전체 테스트에는 기존 Lock 예제 테스트도 포함됩니다.

## 과제 테스트 동작

`beforeEach`에서 `hre.ethers.getSigners()`로 signer0과 signer1을 가져오고, 기존 테스트와 같은 `hre.ethers.deployContract()` 방식으로 `MyToken`을 새로 배포합니다. 토큰은 이름 `MyToken`, 심볼 `MT`, 소수점 자릿수 18이며 signer0에게 100 MT를 발행합니다. 매번 새 계약을 배포하여 다른 테스트의 승인이나 잔액에 영향을 받지 않습니다.

전송 수량은 `hre.ethers.parseUnits("10", decimals)`로 만든 **10 MT**이며 ethers.js v6의 `bigint`로 처리합니다.

1. **전송 전 잔액 조회**: signer0과 signer1의 잔액을 저장하고, signer0의 잔액이 전송 수량 이상인지 확인합니다.
2. **승인**: `myTokenC.connect(signer0).approve(signer1.address, amount)`를 호출합니다. `wait()`로 완료를 기다린 뒤 호출자, 성공 상태, `allowance(signer0.address, signer1.address) == amount`를 검증합니다. 승인만으로 잔액이 변하지 않는지도 확인합니다.
3. **위임 전송**: `myTokenC.connect(signer1).transferFrom(signer0.address, signer1.address, amount)`를 호출합니다. 호출자가 signer1인지, 트랜잭션이 성공했는지, 올바른 인자의 `Transfer` 이벤트가 발생했는지 확인합니다.
4. **전송 후 검증**: Chai `expect()`로 두 계정의 잔액 증감, 남은 허용량 0, 총공급량 보존을 확인합니다.

| 항목 | 승인 전 | 승인 후·전송 전 | 전송 후 |
| --- | ---: | ---: | ---: |
| signer0 잔액 | 100 MT | 100 MT | 90 MT |
| signer1 잔액 | 0 MT | 0 MT | 10 MT |
| signer0 → signer1 allowance | 0 MT | 10 MT | 0 MT |
| 총공급량 | 100 MT | 100 MT | 100 MT |

핵심 잔액 assertion:

```typescript
expect(signer0After).equal(signer0Before - amount);
expect(signer1After).equal(signer1Before + amount);
expect(await myTokenC.allowance(signer0.address, signer1.address)).equal(0n);
```

계약은 강의의 함수·이벤트 형식을 유지합니다. 직접 전송은 `transfer(uint256 amount, address to)`, 승인 이벤트는 `Approval(address indexed spender, uint256 amount)` 형식입니다. 별도 배포용 Ignition 모듈의 초기 발행량은 1 MT이며, 위 과제 테스트는 독립적으로 100 MT를 발행해 검증합니다.
