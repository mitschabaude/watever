import { sum } from "./simple.wat.js";
import { avg, double, isSumEven, howIsSum, createArray } from "./sum.wat.js";

let bytes = new Uint8Array([1, 2, 3, 4]);
let total = await sum(bytes);
console.log(total);

let avgResult = await avg(bytes);
console.log("avg", avgResult);

let doubleResult = await double(bytes);
console.log("double", doubleResult.toString());

console.log(
  "isSumEven",
  await isSumEven(bytes),
  await isSumEven(new Uint8Array([1, 1, 0])),
  await isSumEven(new Uint8Array([1, 1, 1]))
);

console.log(
  "howIsSum",
  await howIsSum(bytes),
  await howIsSum(new Uint8Array([1, 1, 0])),
  await howIsSum(new Uint8Array([1, 1, 1]))
);

// let str = '🤪 hello world! 🤪 ';
// let twiceResult = await twice(str);
// console.log(`twice "${twiceResult}"`);

let arrayResult = await createArray();
console.log("array", JSON.stringify(arrayResult));
