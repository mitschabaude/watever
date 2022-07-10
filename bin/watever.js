#!/usr/bin/env node
import minimist from "minimist";
import path from "node:path";
import fs from "node:fs";
import buildWat from "../index.js";
import { printFunction } from "./printFunction.js";

let { _: watPaths, ...options } = minimist(process.argv.slice(2));

// TODO: support nowrap in some way, but as an annotation in the module, not as a compile flag
// nowrap=true would currently create a wasm bundle without secretly exported alloc, free, memory
// but free/memory would be expected by wrap-wasm
// so need to modify embed-wasm to indicate to wrap-wasm that we don't want that extra exports
let nowrap = false;
let multiple = watPaths.length > 1;

for (let watPath of watPaths) {
  await processWat(watPath, { multiple, ...options, wrap: !nowrap });
}

async function processWat(
  watPath,
  {
    wat,
    all,
    o,
    imports,
    multiple,
    wrap,
    s: silent,
    deno,
    "print-function": iPrintFunction,
    sync,
    "auto-free": autoFree,
  }
) {
  imports = imports ? new Set(imports.split(",")) : undefined;
  let options = multiple
    ? { path: watPath, wrap, deno, sync, noAutoFree: !autoFree }
    : { path: watPath, wrap, deno, imports, sync, noAutoFree: !autoFree };
  let result = await buildWat(options);

  if (iPrintFunction !== undefined) {
    printFunction(result.wat, iPrintFunction);
    return;
  }

  if (all) console.log(result);
  else if (wat) console.log(result.wat);
  else {
    let dir = path.dirname(watPath);
    let base = path
      .basename(watPath)
      .replace(".wasm", ".wasm.js")
      .replace(".wat", ".wat.js")
      .replace(".wast", ".wasm.js");

    let out = o
      ? multiple
        ? path.resolve(o, base)
        : o
      : path.resolve(dir, base);
    if (o && multiple) await ensureDir(o);
    fs.writeFileSync(out, result.js);
    if (!silent)
      console.log(`Wrote ${(result.js.length * 1e-3).toFixed(2)} kB to ${out}`);
  }
}

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) await fs.promises.mkdir(dir);
}
