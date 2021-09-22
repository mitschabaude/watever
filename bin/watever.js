#!/usr/bin/env node
import minimist from "minimist";
import path from "path";
import { bundleWasm } from "../src/bundle-wasm.js";
import fs from "fs";
import embedWasm from "../src/embed-wasm.js";

let {
  _: [watPath],
  wrap,
  wat,
  all,
  o,
  imports,
} = minimist(process.argv.slice(2));

(async () => {
  imports = imports ? new Set(imports.split(",")) : undefined;

  let options = { path: watPath, wrap, imports };
  let result = await bundleWasm(options);
  let content = await embedWasm(result, options);
  result.js = content;

  if (all) console.log(result);
  else if (wat) console.log(result.wat);
  else {
    let dir = path.dirname(watPath);
    let base = path
      .basename(watPath)
      .replace(".wasm", ".wasm.js")
      .replace(".wat", ".wat.js")
      .replace(".wast", ".wasm.js");

    let out = o ?? path.resolve(dir, base);
    fs.writeFileSync(out, result.js);
  }
})();
