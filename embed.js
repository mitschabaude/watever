import { toBase64 } from "fast-base64";
export { embedWasm as default };

let untouchedImports = new Set(["js"]);

async function embedWasm(
  { wasm, wat, exportNames, watchFiles, imports: innerImports }, // result of bundleWasm
  {
    path: wasmPath,
    wrap = false,
    imports: outerImports,
    deno = false,
    sync = false,
    noAutoFree = false,
  } // mostly same options as bundleWasm
) {
  // TODO: enable version which doesn't wrap module at all (just instantiates it & and creates named exports)
  let wasmBase64 = await toBase64(wasm);

  let nonJsImports = {};
  for (let importPath in innerImports) {
    if (untouchedImports.has(importPath)) {
      nonJsImports[importPath] = innerImports[importPath];
      delete innerImports[importPath];
    }
  }

  if (outerImports) {
    exportNames = exportNames.filter((n) => outerImports.has(n));
  }
  let exportString = exportNames.map((e) => e.split("#")[0]).join(", ");
  let jsImportStrings = "";
  let importString = "{ ";
  for (let importPath in innerImports) {
    let importListString = innerImports[importPath]
      .map((s) => s.split("#")[0])
      .join(", ");
    let importObjString =
      "{" +
      innerImports[importPath]
        .map((s) => `"${s}": ${s.split("#")[0]}`)
        .join(", ") +
      "},";
    jsImportStrings += `\nimport {${importListString}} from "${importPath}";`;
    importString += `"${importPath}": ${importObjString}`;
  }
  for (let importPath in nonJsImports) {
    let importListString =
      "{" +
      nonJsImports[importPath]
        .map((s) => `"${s}": "${s.split("#")[0]}"`)
        .join(", ") +
      "},";
    importString += `"${importPath}": ${importListString}`;
  }
  importString += " }";
  let content = "";
  content += `import {wrap} from "watever-js-wrapper";`;
  content += jsImportStrings + "\n";
  content += `let wasm = ${JSON.stringify(wasmBase64)};\n`;
  content += `let {${exportString}} = ${
    sync ? "await " : ""
  }wrap(wasm, ${JSON.stringify(exportNames)}, ${importString}, ${
    noAutoFree ? "{noAutoFree: true}" : "{}"
  });\n`;
  content += `export {${exportString}};\n`;
  if (deno || sync) {
    let wateverJsWrapper =
      deno && sync
        ? "https://raw.githubusercontent.com/mitschabaude/watever/main/watever-js-wrapper/sync.js"
        : deno
        ? "https://raw.githubusercontent.com/mitschabaude/watever/main/watever-js-wrapper/wrap.js"
        : "watever-js-wrapper/sync";
    content = content.replace(
      /from "watever-js-wrapper"/g,
      // `from "../wrap.js"`
      `from "${wateverJsWrapper}"`
    );
  }
  return content;
}

// async function embedUnwrappedWasm(
//   { wasm, wat, exportNames, watchFiles, imports: innerImports }, // result of bundleWasm
//   { path: wasmPath, wrap = false, imports: outerImports } // same options as bundleWasm
// ) {
//   let wasmBase64 = await toBase64(wasm);

//   let content = `import {wrap} from '../src/wrap-wasm.js';
// let wasm = toBytes(${JSON.stringify(wasmBase64)});
// let exportNames = ${JSON.stringify(exportNames)};
// let imports = ${JSON.stringify(innerImports)};
// export {wasm as default, exportNames, imports};\n`;
//   return content;
// }
