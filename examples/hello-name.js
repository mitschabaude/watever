import { hello } from "./hello-name.wat.js";
let greeting = await hello("Gregor");
console.log(greeting);
