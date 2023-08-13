import {
  method,
  SmartContract,
  PublicKey,
  UInt64,
  state,
  State,
  Permissions,
} from 'snarkyjs';

const tokenSymbol = 'MYTKN';

export class SimpleToken extends SmartContract {
  @state(UInt64) totalAmountInCirculation = State<UInt64>();

  init() {
    super.init();
    this.totalAmountInCirculation.set(UInt64.from(0));
    this.account.tokenSymbol.set(tokenSymbol);
    // you will need to change to default permissions in order to approve
    // custom token transactions using signatures
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method mint(address: PublicKey, amount: UInt64) {
    let totalAmountInCirculation =
      this.totalAmountInCirculation.getAndAssertEquals();
    let newTotalAmountInCirculation = totalAmountInCirculation.add(amount);

    this.token.mint({
      address,
      amount,
    });

    this.totalAmountInCirculation.set(newTotalAmountInCirculation);
  }

  @method burn(address: PublicKey, amount: UInt64) {
    let totalAmountInCirculation =
      this.totalAmountInCirculation.getAndAssertEquals();
    let newTotalAmountInCirculation = totalAmountInCirculation.sub(amount);

    this.token.burn({
      address,
      amount,
    });

    this.totalAmountInCirculation.set(newTotalAmountInCirculation);
  }

  @method transfer(
    senderAddress: PublicKey,
    receiverAddress: PublicKey,
    amount: UInt64
  ) {
    this.token.send({
      from: senderAddress,
      to: receiverAddress,
      amount,
    });
  }
}
