export { log, promise };

function log(instance, ...args) {
  console.log(instance, ...args);
}

async function promise(callback) {
  console.log("HEY!");
  await new Promise((r) => setTimeout(r, 1000));
  return callback("WOAH!");
}
