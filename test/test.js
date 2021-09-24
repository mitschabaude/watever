import { sum, memory } from "./simple.wat.js";
import { avg, double, isSumEven, howIsSum, createArray } from "./sum.wat.js";
import { asyncCall } from "./promise.wat.js";

let x = await asyncCall();
console.log(x);

let bytes = new Uint8Array([1, 2, 3, 4]);
let total = await sum(bytes);
console.log("sum", total);

console.log("memory", await memory());

let avgResult = await avg(bytes);
console.log("avg", avgResult);

let doubleResult = await double(bytes);
console.log("double", doubleResult);

console.log(
  "isSumEven",
  await isSumEven(new Uint8Array([1, 1, 0])),
  await isSumEven(new Uint8Array([1, 1, 1]))
);

console.log(
  "howIsSum",
  await howIsSum(new Uint8Array([1, 1, 0])),
  await howIsSum(new Uint8Array([1, 1, 1]))
);

// let str = '🤪 hello world! 🤪 ';
// let twiceResult = await twice(str);
// console.log(`twice "${twiceResult}"`);

let arrayResult = await createArray();
console.log("array", arrayResult);
