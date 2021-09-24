import { sum, memory } from "./simple.wat.js";

let bytes = new Uint8Array([1, 2, 3, 4]);
let total = await sum(bytes);
console.log("sum", total);

console.log("memory", await memory());
