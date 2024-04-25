import { uintOrNaN, transactionBytes, sumOrNaN, dustThreshold, inputBytes as _inputBytes, finalize } from './utils.js'

// only add inputs if they don't bust the target value (aka, exact match)
// worst-case: O(n)
export default function blackjack (utxos, outputs, feeRate) {
  if (!isFinite(uintOrNaN(feeRate))) return {}

  var bytesAccum = transactionBytes([], outputs)

  var inAccum = 0
  var inputs = []
  var outAccum = sumOrNaN(outputs)
  var threshold = dustThreshold({}, feeRate)

  for (var i = 0; i < utxos.length; ++i) {
    var input = utxos[i]
    var inputBytes = _inputBytes(input)
    var fee = feeRate * (bytesAccum + inputBytes)
    var inputValue = uintOrNaN(input.value)

    // would it waste value?
    if ((inAccum + inputValue) > (outAccum + fee + threshold)) continue

    bytesAccum += inputBytes
    inAccum += inputValue
    inputs.push(input)

    // go again?
    if (inAccum < outAccum + fee) continue

    return finalize(inputs, outputs, feeRate)
  }

  return { fee: feeRate * bytesAccum }
}