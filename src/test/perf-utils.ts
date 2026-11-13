import { setImmediate } from 'node:timers/promises';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

setFlagsFromString('--expose-gc');

// The flag applies only to contexts that are created after it is set
const gc: () => void = runInNewContext('gc');

/**
 * Runs a full garbage collection. Waits for the current job to end first, since objects that a WeakRef was created for
 * during the job aren't collected until it ends.
 */
export async function collectGarbage(): Promise<void> {
  await setImmediate();
  gc();
}
