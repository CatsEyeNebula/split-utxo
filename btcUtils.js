import bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import mempoolJS from "@mempool/mempool.js";
import axios from 'axios';
import env from "./env.json" assert { type: "json" };
import { readFile } from "fs/promises";
import {coinSelect} from "./coinselect/index.js"
import { crypto } from 'bitcoinjs-lib';



async function genPrivKeyAndTaprootAddress(ecc,networkName) {
  // 生成一个私钥
  var network
  if (networkName == 'testnet') {
    network = bitcoin.networks.testnet;
  } else if (networkName == 'mainnet') {
    network = bitcoin.networks.bitcoin;
  }
  const ECPair = ECPairFactory(ecc);
  const privateKey = ECPair.makeRandom({ network: network });
  const tweakedSigner = tweakSigner(privateKey, { network }, ECPair);
  const wif = privateKey.toWIF();
  const xOnlyPubkey = tweakedSigner.publicKey.slice(1, 33);
  const taprootAddress = bitcoin.payments.p2tr({
    pubkey: xOnlyPubkey,
    network: network
  });
  return { address: taprootAddress.address, wif: wif }
}

async function batchTransferToSlaves(btcAmount, addressFileName, networkName,feeRate) {
  const ECPair = ECPairFactory(ecc);

  const mainPrivateKey = env.masterBTCAccount.privateKey;
  const fileData = await readFile(
    new URL(`./${addressFileName}.json`, import.meta.url)
  );
  var network
  if (networkName == 'testnet') {
    network = bitcoin.networks.testnet;
  } else if (networkName == 'mainnet') {
    network = bitcoin.networks.bitcoin;
  }
  const psbt = new bitcoin.Psbt({ network });
  const accountsData = JSON.parse(fileData.toString());
  const utxos = await getUTXOs(env.masterBTCAccount.address,networkName);
  console.log("utxos",utxos);
  let targetUtxos = []
  for (const item of accountsData) {
    const address = item.address;
    targetUtxos.push({
      address:address,
      value:Number(btcAmount)
    })
  }
  const { inputs, outputs, fee } = coinSelect(utxos, targetUtxos, Number(feeRate));
  console.log("fee",fee);
  const ecPair = ECPair.fromWIF(mainPrivateKey, network);
  const tweakedSigner = tweakSigner(ecPair, { network }, ECPair);
  const publicKey = ecPair.publicKey
  console.log("inputs",inputs);
  const p2pktr = bitcoin.payments.p2tr({
    pubkey: tweakedSigner.publicKey.slice(1, 33),
    network
  });
  await Promise.all(inputs.map(async (utxo) => {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: p2pktr.output,
        value: utxo.value,
      },
      tapInternalKey: publicKey.slice(1, 33)
    });
  }));
  
  for (const output of outputs) {
    psbt.addOutput({
      address:  output.address !== undefined ? output.address : env.masterBTCAccount.address,
      value:  output.address !== undefined ? output.value : output.value - fee,
    });
  }
  inputs.forEach((utxo, index) => {
    psbt.signInput(index, tweakedSigner);
  });
  psbt.finalizeAllInputs();
  const rawTx = psbt.extractTransaction().toHex();
  const response = await broadcast(rawTx,networkName)
  console.log("rawTx",rawTx);
  console.log("txid : ",response);
}

async function broadcast(txHex,networkName) {
  var blockstream
  if(networkName == 'testnet'){
     blockstream = new axios.Axios({
      baseURL: `https://mempool.space/testnet/api`
    });
  }else if(networkName == 'mainnet'){
    blockstream = new axios.Axios({
      baseURL: `https://mempool.space/api`
    });
  }
  const response = await blockstream.post('/tx', txHex);
  return response.data;
}

async function getUTXOs(address,networkName) {
  if(networkName == 'testnet'){
    const { bitcoin: { addresses } } = mempoolJS({
      hostname: 'mempool.space',
      network: 'testnet'
    });
    const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });
    return addressTxsUtxo
  }else if(networkName == 'mainnet'){
    const { bitcoin: { addresses } } = mempoolJS({
      hostname: 'mempool.space',
    });
    const addressTxsUtxo = await addresses.getAddressTxsUtxo({ address });
    return addressTxsUtxo
  }
}

async function getRecommendedFees(networkName) {
  if(networkName == 'testnet') {
    const { bitcoin: { fees } } = mempoolJS({
      hostname: 'mempool.space',
      network: 'testnet'
    });
    const feesRecommended = await fees.getFeesRecommended();
    return feesRecommended.fastestFee
  }else if(networkName == 'mainnet') {
    const { bitcoin: { fees } } = mempoolJS({
      hostname: 'mempool.space',
    });
    const feesRecommended = await fees.getFeesRecommended();
    return feesRecommended.fastestFee
  }
  
}

function tweakSigner(signer, opts, ECPair) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  let privateKey = signer.privateKey;
  if (!privateKey) {
    throw new Error('Private key is required for tweaking signer!');
  }
  if (signer.publicKey[0] === 3) {
    privateKey = ecc.privateNegate(privateKey);
  }

  const tweakedPrivateKey = ecc.privateAdd(
    privateKey,
    tapTweakHash(signer.publicKey.slice(1, 33), opts.tweakHash),
  );
  if (!tweakedPrivateKey) {
    throw new Error('Invalid tweaked private key!');
  }

  return ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
    network: opts.network,
  });
}

function tapTweakHash(pubKey, h) {
  return crypto.taggedHash(
    'TapTweak',
    Buffer.concat(h ? [pubKey, h] : [pubKey]),
  );
}

async function importPrivateKey(wif, ecc) {
  const ECPair = ECPairFactory(ecc);
  const network = bitcoin.networks.bitcoin;
  const ecPair = ECPair.fromWIF(wif, network);
  const tweakedSigner = tweakSigner(ecPair, { network }, ECPair);
  const xOnlyPubkey = tweakedSigner.publicKey.slice(1, 33);
  const taprootAddress = bitcoin.payments.p2tr({
    pubkey: xOnlyPubkey,
    network: network
  });
  return taprootAddress.address
}

export {
  genPrivKeyAndTaprootAddress,
  importPrivateKey,
  tweakSigner,
  batchTransferToSlaves
}