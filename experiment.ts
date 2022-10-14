import { StargateClient } from "@cosmjs/stargate"
import { IndexedTx, SigningStargateClient } from "@cosmjs/stargate"
import { Tx } from "cosmjs-types/cosmos/tx/v1beta1/tx"
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx"
import { readFile } from "fs/promises"
import { DirectSecp256k1HdWallet, OfflineDirectSigner } from "@cosmjs/proto-signing"

const rpc = "rpc.sentry-01.theta-testnet.polypore.xyz:26657"

const runAll = async(): Promise<void> => {
    const client = await StargateClient.connect(rpc)
    console.log("With client, chain id:", await client.getChainId(), ", height:", await client.getHeight())

    console.log(
        "Alice balances:",
        await client.getAllBalances("cosmos17tvd4hcszq7lcxuwzrqkepuau9fye3dal606zf"), // <-- replace with your generated address
    )
    
    const faucetTx: IndexedTx = (await client.getTx(
        "540484BDD342702F196F84C2FD42D63FA77F74B26A8D7383FAA5AB46E4114A9B",
    ))!
    // console.log("Faucet Tx:", faucetTx)

    const decodedTx: Tx = Tx.decode(faucetTx.tx)
    // console.log("DecodedTx:", decodedTx)
    
    const sendMessage: MsgSend = MsgSend.decode(decodedTx.body!.messages[0].value)
    // console.log("Sent message:", sendMessage)

    const getAliceSignerFromMnemonic = async (): Promise<OfflineDirectSigner> => {
        return DirectSecp256k1HdWallet.fromMnemonic((await readFile("./testnet.alice.mnemonic.key")).toString(), {
            prefix: "cosmos",
        })
    }
    
    const aliceSigner: OfflineDirectSigner = await getAliceSignerFromMnemonic()

    const alice = (await aliceSigner.getAccounts())[0].address
    console.log("Alice's address from signer", alice)
    const signingClient = await SigningStargateClient.connectWithSigner(rpc, aliceSigner)
    // console.log(
    //     "With signing client, chain id:",
    //     await signingClient.getChainId(),
    //     ", height:",
    //     await signingClient.getHeight()
    // )
    const rawLog = JSON.parse(faucetTx.rawLog)
    // console.log("Raw log:", JSON.stringify(rawLog, null, 4))

    const faucet: string = rawLog[0].events
    .find((eventEl: any) => eventEl.type === "coin_spent")
    .attributes.find((attribute: any) => attribute.key === "spender").value

    console.log("Gas fee:", decodedTx.authInfo!.fee!.amount)
    console.log("Gas limit:", decodedTx.authInfo!.fee!.gasLimit.toString(10))

    // Check the balance of Alice and the Faucet
    console.log("Alice balance before:", await client.getAllBalances(alice))
    console.log("Faucet balance before:", await client.getAllBalances(faucet))
    // Execute the sendTokens Tx and store the result
    const result = await signingClient.sendTokens(
        alice,
        faucet,
        [{ denom: "uatom", amount: "100000" }],
        {
            amount: [{ denom: "uatom", amount: "500" }],
            gas: "200000",
        },
    )
    // Output the result of the Tx
    console.log("Transfer result:", result)

}


runAll()
