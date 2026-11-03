// How long the browser checks' waits are, times TEST_PATIENCE (the gate sets it from the
// machine's load, 1 to 3): a check that waits a minute on a quiet machine waits three under
// load, so a slow answer is not read as a failure.
export const P = Math.max(1, Number(process.env.TEST_PATIENCE) || 1);
