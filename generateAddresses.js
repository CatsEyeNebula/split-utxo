import * as cryptoUtils from './btcUtils.js';
import * as ecc from 'tiny-secp256k1';
import {initEccLib} from 'bitcoinjs-lib/src/ecc_lib.js'
import { writeFile } from 'fs/promises';
initEccLib(ecc)


const generateAccounts = async(numberOfAccounts,projectName,networkName) =>{
    const accounts = [];

    for(let i = 0; i < numberOfAccounts; i++){
        const { address, wif } = await cryptoUtils.genPrivKeyAndTaprootAddress(ecc,networkName);
        const wifbuffer = Buffer.from(wif,'utf-8')
        const account = {
            address: address,
            privateKey: wifbuffer.toString()
        };        
        accounts.push(account);
    }
    const fileName = `${projectName}.json`;
    await writeFile(fileName, JSON.stringify(accounts, null, 2), 'utf-8');
    console.log(`Accounts have been saved to ${projectName}.json`);
}

export {
    generateAccounts
}



