/** @deprecated Use Implementation.createFromAwarded — kept for deployments that still reference this path */
export { default as Implementation } from '../models/Implementation.js';

import Implementation from '../models/Implementation.js';

export async function createAwardedImplementation(params) {
  return Implementation.createFromAwarded(params);
}
