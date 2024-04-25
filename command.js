import { generateAccounts } from "./generateAddresses.js";

import { batchTransferToSlaves } from './btcUtils.js'


const [, , scriptName, ...args] = process.argv;

// 根据传入的脚本名称调用相应的脚本
switch (scriptName) {
    case "generate":
        generateAccounts(...args)
            .then(() => {
                console.log("BTC accounts done");
            })
            .catch((err) => {
                console.error("BTC accounts error:", err);
            });
        break;
    case "transfer":
        batchTransferToSlaves(...args)
            .then(() => {
                console.log("transfer done");
            })
            .catch((err) => {
                console.error("transfer error:", err);
            });
        break;


    default:
        console.error("what is this script? you must be wrong:", scriptName);
        break;
}
