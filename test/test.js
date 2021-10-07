import { sum, memory } from "./simple.wat.js";
import { avg, double, isSumEven, howIsSum, createArray } from "./sum.wat.js";
import { asyncCall } from "./promise.wat.js";

let x = await asyncCall();
console.log(x);

let bytes = new Uint8Array([1, 2, 3, 4]);
let total = sum(bytes);
console.log("sum", total);

console.log("memory", memory);

let avgResult = avg(bytes);
console.log("avg", avgResult);

let doubleResult = double(bytes);
console.log("double", doubleResult);

console.log(
  "isSumEven",
  isSumEven(new Uint8Array([1, 1, 0])),
  isSumEven(new Uint8Array([1, 1, 1]))
);

console.log(
  "howIsSum",
  howIsSum(new Uint8Array([1, 1, 0])),
  howIsSum(new Uint8Array([1, 1, 1]))
);

// let str = '🤪 hello world! 🤪 ';
// let twiceResult = await twice(str);
// console.log(`twice "${twiceResult}"`);

let arrayResult = createArray();
console.log("array", arrayResult);
