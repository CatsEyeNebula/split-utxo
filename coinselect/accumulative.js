import { uintOrNaN, transactionBytes, sumOrNaN, inputBytes, finalize } from './utils.js'

// add inputs until we reach or surpass the target value (or deplete)
// worst-case: O(n)
export default function accumulative (utxos, outputs, feeRate) {
  if (!isFinite(uintOrNaN(feeRate))) return {}
  var bytesAccum = transactionBytes([], outputs)

  var inAccum = 0
  var inputs = []
  var outAccum = sumOrNaN(outputs)

  for (var i = 0; i < utxos.length; ++i) {
    var utxo = utxos[i]
    var utxoBytes = inputBytes(utxo)
    var utxoFee = feeRate * utxoBytes
    var utxoValue = uintOrNaN(utxo.value)

    // skip detrimental input
    if (utxoFee > utxo.value) {
      if (i === utxos.length - 1) return { fee: feeRate * (bytesAccum + utxoBytes) }
      continue
    }

    bytesAccum += utxoBytes
    inAccum += utxoValue
    inputs.push(utxo)

    var fee = feeRate * bytesAccum

    // go again?
    if (inAccum < outAccum + fee) continue

    return finalize(inputs, outputs, feeRate)
  }

  return { fee: feeRate * bytesAccum }
}