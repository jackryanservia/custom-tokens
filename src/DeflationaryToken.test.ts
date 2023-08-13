import { DeflationaryToken } from './DeflationaryToken';
import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  UInt64,
  TokenId,
  Signature,
} from 'snarkyjs';

// TODO: Add more comments explaining transactions and tests

let proofsEnabled = false;

describe('DeflationaryToken', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    receiverAccount: PublicKey,
    receiverKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: DeflationaryToken;

  beforeAll(async () => {
    if (proofsEnabled) await DeflationaryToken.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    ({ privateKey: senderKey, publicKey: senderAccount } =
      Local.testAccounts[1]);
    ({ privateKey: receiverKey, publicKey: receiverAccount } =
      Local.testAccounts[2]);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new DeflationaryToken(zkAppAddress);
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  it('generates and deploys the `DeflationaryToken` smart contract', async () => {
    await localDeploy();

    const totalAmountInCirculation = zkApp.totalAmountInCirculation.get();
    expect(totalAmountInCirculation).toEqual(UInt64.from(0));

    const tokenSymbol = Mina.getAccount(zkAppAddress).tokenSymbol;
    expect(tokenSymbol).toEqual('MYTKN');
  });

  it('mints custom tokens using the `DeflationaryToken` smart contract (signature)', async () => {
    await localDeploy();

    // mint transaction
    const txn = await Mina.transaction(senderAccount, () => {
      AccountUpdate.fundNewAccount(senderAccount);
      zkApp.mint(
        senderAccount,
        UInt64.from(1_000_000),
        Signature.create(
          zkAppPrivateKey,
          senderAccount.toFields().concat(UInt64.from(1_000_000).toFields())
        )
      );
      zkApp.requireSignature();
    });
    // await txn.prove();
    await txn.sign([senderKey, zkAppPrivateKey]).send();

    const tokenId = TokenId.derive(zkAppAddress, Field(1));

    const totalAmountInCirculation = zkApp.totalAmountInCirculation.get();
    expect(totalAmountInCirculation).toEqual(UInt64.from(1_000_000));

    const senderBalance = Mina.getBalance(senderAccount, tokenId);
    expect(senderBalance).toEqual(UInt64.from(1_000_000));

    // mint transaction with invalid signature
    expect(() => {
      zkApp.mint(
        senderAccount,
        UInt64.from(1_000_000),
        Signature.create(
          receiverKey,
          senderAccount.toFields().concat(UInt64.from(1_000_000).toFields())
        )
      );
    }).toThrow('Bool.assertTrue(): false != true');
  });

  it('mints custom tokens using the `DeflationaryToken` smart contract (proof)', async () => {
    await localDeploy();

    // mint transaction
    const txn = await Mina.transaction(senderAccount, () => {
      AccountUpdate.fundNewAccount(senderAccount);
      zkApp.mint(
        senderAccount,
        UInt64.from(1_000_000),
        Signature.create(
          zkAppPrivateKey,
          senderAccount.toFields().concat(UInt64.from(1_000_000).toFields())
        )
      );
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    const tokenId = TokenId.derive(zkAppAddress, Field(1));

    const totalAmountInCirculation = zkApp.totalAmountInCirculation.get();
    expect(totalAmountInCirculation).toEqual(UInt64.from(1_000_000));

    const senderBalance = Mina.getBalance(senderAccount, tokenId);
    expect(senderBalance).toEqual(UInt64.from(1_000_000));

    // mint transaction with invalid signature
    expect(() => {
      zkApp.mint(
        senderAccount,
        UInt64.from(1_000_000),
        Signature.create(
          receiverKey,
          senderAccount.toFields().concat(UInt64.from(1_000_000).toFields())
        )
      );
    }).toThrow('Bool.assertTrue(): false != true');
  });

  it('burns custom tokens using the `DeflationaryToken` smart contract (proof)', async () => {
    await localDeploy();

    // mint transaction
    const txn1 = await Mina.transaction(senderAccount, () => {
      AccountUpdate.fundNewAccount(senderAccount);
      zkApp.mint(
        senderAccount,
        UInt64.from(1_000_000),
        Signature.create(
          zkAppPrivateKey,
          senderAccount.toFields().concat(UInt64.from(1_000_000).toFields())
        )
      );
    });
    await txn1.prove();
    await txn1.sign([senderKey]).send();

    const tokenId = TokenId.derive(zkAppAddress, Field(1));

    const totalAmountInCirculation = zkApp.totalAmountInCirculation.get();
    expect(totalAmountInCirculation).toEqual(UInt64.from(1_000_000));

    const senderBalance = Mina.getBalance(senderAccount, tokenId);
    expect(senderBalance).toEqual(UInt64.from(1_000_000));

    // burn transaction
    const txn2 = await Mina.transaction(senderAccount, () => {
      zkApp.burn(
        senderAccount,
        UInt64.from(1_000_000),
        Signature.create(
          zkAppPrivateKey,
          senderAccount.toFields().concat(UInt64.from(1_000_000).toFields())
        )
      );
    });
    await txn2.prove();
    await txn2.sign([senderKey]).send();

    const newTotalAmountInCirculation = zkApp.totalAmountInCirculation.get();
    expect(newTotalAmountInCirculation).toEqual(UInt64.from(0));

    const newSenderBalance = Mina.getBalance(senderAccount, tokenId);
    expect(newSenderBalance).toEqual(UInt64.from(0));

    // burn transaction with invalid signature
    expect(() => {
      zkApp.burn(
        senderAccount,
        UInt64.from(1_000_000),
        Signature.create(
          receiverKey,
          senderAccount.toFields().concat(UInt64.from(1_000_000).toFields())
        )
      );
    }).toThrow('Bool.assertTrue(): false != true');
  });

  it('transfers custom tokens using the `DeflationaryToken` smart contract (proof)', async () => {
    await localDeploy();

    // mint transaction
    const txn1 = await Mina.transaction(senderAccount, () => {
      AccountUpdate.fundNewAccount(senderAccount);
      zkApp.mint(
        senderAccount,
        UInt64.from(1_000_000),
        Signature.create(
          zkAppPrivateKey,
          senderAccount.toFields().concat(UInt64.from(1_000_000).toFields())
        )
      );
    });
    await txn1.prove();
    await txn1.sign([senderKey]).send();

    const tokenId = TokenId.derive(zkAppAddress, Field(1));

    const totalAmountInCirculation = zkApp.totalAmountInCirculation.get();
    expect(totalAmountInCirculation).toEqual(UInt64.from(1_000_000));

    const senderBalance = Mina.getBalance(senderAccount, tokenId);
    expect(senderBalance).toEqual(UInt64.from(1_000_000));

    expect(() => {
      Mina.getBalance(receiverAccount, tokenId);
    }).toThrow(/^getAccount: Could not find account for public key(.*)$/);

    // transfer transaction
    const txn2 = await Mina.transaction(senderAccount, () => {
      AccountUpdate.fundNewAccount(receiverAccount);
      zkApp.transfer(
        senderAccount,
        receiverAccount,
        UInt64.from(100_000),
        Signature.create(
          senderKey,
          receiverAccount.toFields().concat(UInt64.from(100_000).toFields())
        )
      );
    });
    await txn2.prove();
    await txn2.sign([senderKey, receiverKey]).send();

    const newTotalAmountInCirculation = zkApp.totalAmountInCirculation.get();
    expect(newTotalAmountInCirculation).toEqual(UInt64.from(999_000));

    const newSenderBalance = Mina.getBalance(senderAccount, tokenId);
    expect(newSenderBalance).toEqual(UInt64.from(899_000));

    const newReceiverBalance = Mina.getBalance(receiverAccount, tokenId);
    expect(newReceiverBalance).toEqual(UInt64.from(100_000));

    // transfer transaction with invalid signature
    expect(() => {
      zkApp.transfer(
        senderAccount,
        receiverAccount,
        UInt64.from(100_000),
        Signature.create(
          receiverKey,
          receiverAccount.toFields().concat(UInt64.from(100_000).toFields())
        )
      );
    }).toThrow('Bool.assertTrue(): false != true');
  });
});
