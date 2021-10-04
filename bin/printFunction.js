import { parse } from "@webassemblyjs/wast-parser";

export function printFunction(wat, i) {
  let ast = parse(wat);
  let i_ = 0;
  for (let field of ast.body[0].fields) {
    if (
      field.type === "Func" ||
      (field.type === "ModuleImport" && field.descr.type === "FuncImportDescr")
    ) {
      if (i_ === i) {
        let lines = wat.split("\n");
        for (let j = field.loc.start.line - 1; j < field.loc.end.line; j++) {
          console.log(lines[j]);
        }
        break;
      }
      ++i_;
    }
  }
}
