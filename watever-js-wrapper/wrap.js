export { wrap, addLock, removeLock };

let modules = {};
let currentId = 0;
let encoder = new TextEncoder();
let decoder = new TextDecoder();

function wrap(wasmCode, exports, imports = {}) {
  if (imports.js) {
    for (let importStr in imports.js) {
      imports.js[importStr] = (0, eval)(imports.js[importStr]);
    }
  }
  let wrapper = (modules[currentId++] = { imports, externrefs: {} });
  for (let importModule of Object.values(imports)) {
    for (let name in importModule) {
      let imported = importModule[name];
      if (typeof imported === "function") {
        let flags = name.split("#")[1]?.split(",") ?? [];
        importModule[name] = wrapImportFunction(imported, wrapper, flags);
      }
    }
  }
  if (typeof wasmCode === "string") wasmCode = toBytes(wasmCode);
  let instantiated = WebAssembly.instantiate(wasmCode, imports);
  wrapper.modulePromise = instantiated.then((i) => i.module);
  wrapper.instancePromise = instantiated.then((i) => i.instance);
  wrapper.instancePromise.then((i) => {
    wrapper.instance = i;
  });
  return Object.fromEntries(
    exports.map((exp) => {
      let [actualExport, flags] = exp.split("#");
      flags = flags?.split(",") ?? [];
      return [actualExport, wrapFunction(exp, wrapper, flags)];
    })
  );
}

async function getInstance(wrapper) {
  let { modulePromise, instancePromise, imports } = wrapper;
  if (instancePromise === undefined) {
    wrapper.instancePromise = modulePromise.then((m) =>
      WebAssembly.instantiate(m, imports)
    );
    wrapper.instance = await wrapper.instancePromise;
    return wrapper.instance;
  } else {
    return instancePromise;
  }
}

function wrapFunction(name, wrapper, flags) {
  let doLift = flags.includes("lift");
  let doLower = true; //flags.includes("lower");

  return async function call(...args) {
    let instance = await getInstance(wrapper);
    let func = instance.exports[name];
    if (typeof func !== "function") return func;
    let actualArgs = doLower ? args.map((arg) => lower(arg, wrapper)) : args;
    try {
      let result = func(...actualArgs);
      return doLift ? lift(result, wrapper) : result;
    } finally {
      cleanup(wrapper);
    }
  };
}

function cleanup(wrapper) {
  let { memory, reset } = wrapper.instance.exports;
  reset();
  wrapper.externrefs = {};
  if (memory.buffer.byteLength >= 1e7) {
    console.warn(
      "Cleaning up Wasm instance, memory limit of 10MB was exceeded."
    );
    queueMicrotask(() => {
      wrapper.instancePromise = undefined;
      wrapper.instance = undefined;
    });
  }
}

function wrapImportFunction(func, wrapper, flags) {
  let doLift = flags.includes("lift");
  let doLower = true; //flags.includes("lower");
  let doInstance = flags.includes("instance");

  return function call(...args) {
    let actualArgs = doLift ? args.map((arg) => lift(arg, wrapper)) : args;
    let result = doInstance
      ? func(wrapper.instance, ...actualArgs)
      : func(...actualArgs);
    return doLower ? lower(result, wrapper) : result;
  };
}

function wrapLiftedFunction(func, wrapper) {
  // both lift and lower for greatest flexibility and for lack of an annotation so far
  return function call(...args) {
    let actualArgs = args.map((arg) => lower(arg, wrapper));
    try {
      let result = func(...actualArgs);
      return lift(result, wrapper);
    } finally {
      cleanup(wrapper);
    }
  };
}

let refId = 0;

function lower(value, wrapper) {
  let { alloc, memory } = wrapper.instance.exports;
  switch (typeof value) {
    case "undefined":
      return undefined;
    case "number":
      return value;
    case "string": {
      // allocate conservative estimate of string length
      let pointer = alloc(4 * value.length);
      let copy = new Uint8Array(memory.buffer, pointer, 2 * value.length);
      let { written } = encoder.encodeInto(value, copy);
      let length = written ?? 0;
      // replace length written by alloc to actual string length
      // (this operation is allowed as long as the length gets smaller)
      let view = new DataView(memory.buffer, pointer - 4, 4);
      view.setInt32(0, length, true);
      return pointer;
    }
    case "object": {
      let isTypedArray = ArrayBuffer.isView(value);
      if (isTypedArray || value instanceof ArrayBuffer) {
        let length = value.byteLength;
        let pointer = alloc(length);
        let uint8value = isTypedArray
          ? value instanceof Uint8Array
            ? value
            : new Uint8Array(value.buffer)
          : new Uint8Array(value);
        let copy = new Uint8Array(memory.buffer, pointer, length);
        copy.set(uint8value);
        return pointer;
      } else {
        let id = refId++;
        wrapper.externrefs[id] = value;
        return id;
      }
    }
    default:
      console.log("error lowering", value);
      throw Error("lowering value not supported");
  }
}

function lift(value, wrapper) {
  if (value === undefined) return undefined;
  let { memory } = wrapper.instance.exports;
  return readValue({
    memory,
    view: new DataView(memory.buffer, value, 1024),
    offset: 0,
    wrapper,
  });
}

function readValue(context) {
  let { memory, offset, view } = context;
  offset += 4;
  let type = view.getUint8(offset++);
  let value;
  switch (type) {
    case 0:
      offset += 4;
      value = view.getInt32(offset, true);
      offset += 4;
      break;
    case 1:
      offset += 4;
      value = view.getFloat64(offset, true);
      offset += 8;
      break;
    case 2:
      offset += 4;
      value = !!view.getUint8(offset++);
      break;
    case 3:
    case 4: {
      offset += 4;
      let pointer2 = view.getUint32(offset, true);
      offset += 4;
      offset += 4;
      let length = view.getUint32(offset, true);
      offset += 4;
      if (type === 3)
        value = new Uint8Array(
          memory.buffer.slice(pointer2, pointer2 + length)
        );
      else {
        value = decoder.decode(new Uint8Array(memory.buffer, pointer2, length));
      }
      break;
    }
    case 5:
    case 6: {
      offset += 4;
      let length = view.getUint8(offset++);
      value = new Array(length);
      context.offset = offset;
      for (let i = 0; i < length; i++) {
        value[i] = readValue(context);
      }
      offset = context.offset;
      if (type === 6) value = Object.fromEntries(value);
      break;
    }
    case 7: {
      offset += 4;
      value = view.getInt32(offset, true);
      value = context.wrapper.externrefs[value];
      offset += 4;
      break;
    }
    case 8: {
      let { table } = context.wrapper.instance.exports;
      offset += 4;
      let index = view.getInt32(offset, true);
      offset += 4;
      value = wrapLiftedFunction(table.get(index), context.wrapper);
      break;
    }
  }
  context.offset = offset;
  return value;
}

let locks = new Set();
let maxLock = -1;
function addLock(lock) {
  locks.add(lock);
  if (lock > maxLock) maxLock = lock;
  return maxLock;
}
function removeLock(lock) {
  locks.delete(lock);
  if (lock === maxLock) {
    maxLock = Math.max(...locks);
  }
  if (maxLock === -Infinity) maxLock = -1;
  return maxLock;
}

function toBytes(base64) {
  base64 = base64.replace(/=/g, "");
  let n = base64.length;
  let rem = n % 4;
  let k = rem && rem - 1; // how many bytes the last base64 chunk encodes
  let m = (n >> 2) * 3 + k; // total encoded bytes

  let encoded = new Uint8Array(n + 3);
  encoder.encodeInto(base64 + "===", encoded);

  for (let i = 0, j = 0; i < n; i += 4, j += 3) {
    let x =
      (lookup[encoded[i]] << 18) +
      (lookup[encoded[i + 1]] << 12) +
      (lookup[encoded[i + 2]] << 6) +
      lookup[encoded[i + 3]];
    encoded[j] = x >> 16;
    encoded[j + 1] = (x >> 8) & 0xff;
    encoded[j + 2] = x & 0xff;
  }
  return new Uint8Array(encoded.buffer, 0, m);
}
const alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const lookup = Object.fromEntries(
  Array.from(alphabet).map((a, i) => [a.charCodeAt(0), i])
);
lookup["=".charCodeAt(0)] = 0;
