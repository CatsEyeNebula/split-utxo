// baseline estimates, used to improve performance
const TX_EMPTY_SIZE = 4 + 1 + 1 + 4;
const TX_INPUT_BASE = 32 + 4 + 1 + 4;
const TX_INPUT_PUBKEYHASH = 107;
const TX_OUTPUT_BASE = 8 + 1;
const TX_OUTPUT_PUBKEYHASH = 25;

function inputBytes(input) {
  return TX_INPUT_BASE + (input.script ? input.script.length : TX_INPUT_PUBKEYHASH);
}

function outputBytes(output) {
  return TX_OUTPUT_BASE + (output.script ? output.script.length : TX_OUTPUT_PUBKEYHASH);
}

function dustThreshold(output, feeRate) {
  /* ... classify the output for input estimate  */
  return inputBytes({}) * feeRate;
}

function transactionBytes(inputs, outputs) {
  return (
    TX_EMPTY_SIZE +
    inputs.reduce((a, x) => a + inputBytes(x), 0) +
    outputs.reduce((a, x) => a + outputBytes(x), 0)
  );
}

function uintOrNaN(v) {
  if (typeof v !== 'number') return NaN;
  if (!isFinite(v)) return NaN;
  if (Math.floor(v) !== v) return NaN;
  if (v < 0) return NaN;
  return v;
}

function sumForgiving(range) {
  return range.reduce((a, x) => a + (isFinite(x.value) ? x.value : 0), 0);
}

function sumOrNaN(range) {
  return range.reduce((a, x) => a + uintOrNaN(x.value), 0);
}

const BLANK_OUTPUT = outputBytes({});

function finalize(inputs, outputs, feeRate) {
  const bytesAccum = transactionBytes(inputs, outputs);
  const feeAfterExtraOutput = feeRate * (bytesAccum + BLANK_OUTPUT);
  const remainderAfterExtraOutput = sumOrNaN(inputs) - (sumOrNaN(outputs) + feeAfterExtraOutput);

  // is it worth a change output?
  if (remainderAfterExtraOutput > dustThreshold({}, feeRate)) {
    outputs = outputs.concat({ value: remainderAfterExtraOutput });
  }

  const fee = sumOrNaN(inputs) - sumOrNaN(outputs);
  if (!isFinite(fee)) return { fee: feeRate * bytesAccum };

  return {
    inputs,
    outputs,
    fee
  };
}

export  {
  dustThreshold,
  finalize,
  inputBytes,
  outputBytes,
  sumOrNaN,
  sumForgiving,
  transactionBytes,
  uintOrNaN
};
