import { bundleWasm } from "./bundle.js";
import embedWasm from "./embed.js";

export { buildWat as default };

async function buildWat(options) {
  let result = await bundleWasm(options);
  let content = await embedWasm(result, options);
  result.js = content;
  return result;
}
