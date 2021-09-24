export { asyncFunction };

async function asyncFunction() {
  console.log("logged inside async JS");
  await new Promise((r) => setTimeout(r, 100));
  return "returned from async JS";
}
