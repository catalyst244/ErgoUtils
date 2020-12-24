import {getWalletAddress,} from './helpers';
import {Address} from '@coinbarn/ergo-ts';
import {addReq, follow, p2s, txFee} from "./assembler";
import {encodeHex} from "./serializer";
import {Serializer} from "@coinbarn/ergo-ts/dist/serializer";

const template = `{
  val outputOk = {
    val assetType = OUTPUTS(0).R7[Coll[Byte]].get
    val artworkHash = OUTPUTS(0).R8[Coll[Byte]].get
    val issued = OUTPUTS(0).tokens.getOrElse(0, (INPUTS(0).id, 0L))
    INPUTS(0).id == issued._1 && issued._2 == 1 &&
      OUTPUTS(0).value == $ergAmountL &&
      OUTPUTS(0).propositionBytes == fromBase64("$toAddress") &&
      assetType == fromBase64("$artworkType") &&
      artworkHash == fromBase64("$curHash")
  }
  val returnFunds = {
    val total = INPUTS.fold(0L, {(x:Long, b:Box) => x + b.value}) - 4000000
    OUTPUTS(0).value >= total && OUTPUTS(0).propositionBytes == fromBase64("$userAddress")
  }
  sigmaProp(OUTPUTS.size == 2 && (outputOk || returnFunds))
}`;

const assetType = '0101'

export async function issueArtworkNFT(ergAmount, toAddress, name, description, address, artHash, url = null) {
    let ourAddr = getWalletAddress();

    let outBox = {
        ergValue: ergAmount,
        amount: 1,
        address: toAddress,
        name: name,
        description: description,
        decimals: 0,
        registers: {
            R7: await encodeHex(Serializer.stringToHex(assetType)),
            R8: await encodeHex(artHash),
        }
    };

    if (url) outBox.registers.R9 = await encodeHex(Serializer.stringToHex(url))

    let request = {
        address: address,
        returnTo: ourAddr,
        startWhen: {
            erg: ergAmount + txFee,
        },
        txSpec: {
            requests: [outBox],
            fee: txFee,
            inputs: ['$userIns'],
            dataInputs: [],
        },
    };
    return follow(request).then(res => {
        if (res.id !== undefined) {
            let toFollow = {
                id: res.id,
                key: 'artworkNFT',
                status: 'follow',
                operation: 'creating artwork NFT'
            };
            addReq(toFollow, 'reqs')
        }
        return res
    })
}

export async function geArtworkP2s(toAddress, ergAmount, artworkHash) {
    let ourAddr = getWalletAddress();
    let userTreeHex = new Address(ourAddr).ergoTree
    let toTreeHex = new Address(toAddress).ergoTree

    let userTree = Buffer.from(userTreeHex, 'hex').toString('base64');
    let toTree = Buffer.from(toTreeHex, 'hex').toString('base64');
    let artworkHash64 = Buffer.from(artworkHash, 'hex').toString('base64');
    let encodedAssetType = Buffer.from(Serializer.stringToHex(assetType), 'hex').toString('base64');

    let script = template
        .replace('$userAddress', userTree)
        .replace('$ergAmount', ergAmount)
        .replace('$toAddress', toTree)
        .replace('$artworkType', encodedAssetType)
        .replace('$curHash', artworkHash64)
        .replaceAll('\n', '\\n');
    return p2s(script);
}

export async function uploadArtwork(file, upload) {
    if (upload) {
        let form = new FormData();
        form.append("image", file)
        return fetch("https://api.imgbb.com/1/upload?key=951beda2107cac29c2409c886d4a192b", {
            method: 'POST',
            mode: 'cors',
            body: form,
        }).then(res => res.json())
            .then(res => res.data.url)
    } else return null
}
