export { wrap, addLock, removeLock };

let modules = {};
let currentId = 0;
let encoder = new TextEncoder();
let decoder = new TextDecoder();

async function wrap(
  wasmCode,
  exports,
  imports = {},
  { noAutoFree = false } = {}
) {
  if (typeof wasmCode === "string") wasmCode = toBytes(wasmCode);

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
        let flags = name.split("#")[1];
        flags = flags !== undefined ? flags.split(",") : [];
        importModule[name] = wrapImportFunction(imported, wrapper, flags);
      }
    }
  }

  let instantiated = await WebAssembly.instantiate(wasmCode, imports);
  wrapper.instance = instantiated.instance;

  return Object.fromEntries(
    exports.map((exp) => {
      let [actualExport, flags] = exp.split("#");
      flags = flags !== undefined ? flags.split(",") : [];
      if (noAutoFree) flags.push("noAutoFree");
      return [actualExport, wrapFunction(exp, wrapper, flags)];
    })
  );
}

function wrapFunction(name, wrapper, flags) {
  let doLift = flags.includes("lift");
  let doCleanup = !flags.includes("noAutoFree");
  let func = wrapper.instance.exports[name];
  if (typeof func !== "function") return func;

  return function call(...args) {
    let actualArgs = args.map((arg) => lower(arg, wrapper));
    try {
      let result = func(...actualArgs);
      return doLift ? lift(result, wrapper) : result;
    } finally {
      if (doCleanup) cleanup(wrapper);
    }
  };
}

function cleanup(wrapper) {
  wrapper.instance.exports.reset();
  wrapper.externrefs = {};
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
  if (typeof value === "number" || value === undefined) return value;
  let { alloc, memory } = wrapper.instance.exports;
  switch (typeof value) {
    case "string": {
      // allocate conservative estimate of string length
      let pointer = alloc(4 * value.length);
      let copy = new Uint8Array(memory.buffer, pointer, 2 * value.length);
      let { written } = encoder.encodeInto(value, copy);
      let length = written !== undefined ? written : 0;
      // replace length written by alloc to actual string length
      // (this operation is allowed as long as the length gets smaller)
      let view = new DataView(memory.buffer, pointer - 8, 4);
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

const INT = 0;
const FLOAT = 1;
const BOOL = 2;
const BYTES = 3;
const STRING = 4;
const ARRAY = 5;
const OBJECT = 6;
const EXTERN = 7;
const FUNCTION = 8;
const UINT64ARRAY = 9;

function readValue(context) {
  let { memory, offset, view } = context;
  offset += 8; // skip length
  let type = view.getUint8(offset);
  offset += 8; // int8 type
  let value;
  switch (type) {
    case INT:
      offset += 8; // skip length
      value = view.getInt32(offset, true);
      offset += 8; // int32
      break;
    case FLOAT:
      offset += 8; // skip length
      value = view.getFloat64(offset, true);
      offset += 8; // float
      break;
    case BOOL:
      offset += 8; // skip length
      value = !!view.getUint8(offset);
      offset += 8; // bool
      break;
    case BYTES:
    case STRING:
    case UINT64ARRAY: {
      offset += 8; // skip length
      let pointer = view.getUint32(offset, true);
      offset += 8; // int32 pointer
      // ---------------------------------------
      offset += 8; // skip length
      let length = view.getUint32(offset, true);
      offset += 8; // int32 length
      if (type === BYTES)
        value = new Uint8Array(memory.buffer.slice(pointer, pointer + length));
      else if (type === UINT64ARRAY) {
        value = new BigUint64Array(
          memory.buffer.slice(pointer, pointer + length)
        );
      } else {
        value = decoder.decode(new Uint8Array(memory.buffer, pointer, length));
      }
      break;
    }
    case ARRAY:
    case OBJECT: {
      offset += 8; // skip length
      let length = view.getUint8(offset);
      offset += 8; // int8 array length
      value = new Array(length);
      context.offset = offset;
      for (let i = 0; i < length; i++) {
        value[i] = readValue(context);
      }
      offset = context.offset;
      if (type === OBJECT) value = Object.fromEntries(value);
      break;
    }
    case EXTERN: {
      offset += 8; // skip length
      value = view.getInt32(offset, true);
      value = context.wrapper.externrefs[value];
      offset += 8; // int32 externref index
      break;
    }
    case FUNCTION: {
      let { table } = context.wrapper.instance.exports;
      offset += 8; // skip length
      let index = view.getInt32(offset, true);
      offset += 8; // int32 table index
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
