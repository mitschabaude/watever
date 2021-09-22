export { wrap };

let modules = {};
let currentId = 0;
let encoder = new TextEncoder();
let decoder = new TextDecoder();

function wrap(wasmCode, exports, imports) {
  let id = currentId++;
  if (imports.js) {
    for (let importStr in imports.js) {
      imports.js[importStr] = (0, eval)(importStr);
    }
  }
  if (typeof wasmCode === "string") wasmCode = toBytes(wasmCode);
  let instantiated = WebAssembly.instantiate(wasmCode, imports);
  modules[id] = {
    modulePromise: instantiated.then((i) => i.module),
    instancePromise: instantiated.then((i) => i.instance),
  };
  return Object.fromEntries(
    exports.map((n) => [n, wrapFunction(n, modules[id])])
  );
}

async function reinstantiate(wrapper) {
  let { modulePromise, instancePromise } = wrapper;
  if (instancePromise === undefined) {
    wrapper.instancePromise = instancePromise = modulePromise.then((m) =>
      WebAssembly.instantiate(m)
    );
  }
  return instancePromise;
}

function wrapFunction(name, wrapper) {
  return async function call(...args) {
    let instance = await reinstantiate(wrapper);
    let func = instance.exports[name];
    let { free, memory } = instance.exports;
    let actualArgs = args.map((arg) => lower(arg, instance));

    // let totalBytes = 0;
    // for (let i = 0; i < args.length; i++) {
    //   let arg = args[i];
    //   if (typeof arg === "number") {
    //   } else if (typeof arg === "string") {
    //     totalBytes += 2 * arg.length;
    //   } else {
    //     totalBytes += arg.byteLength;
    //   }
    // }
    // let offset = alloc(totalBytes);
    // let actualArgs = [];
    // for (let arg of args) {
    //   if (typeof arg === "number") {
    //     actualArgs.push(arg);
    //   } else if (typeof arg === "string") {
    //     let copy = new Uint8Array(memory.buffer, offset, 2 * arg.length);
    //     let { written } = encoder.encodeInto(arg, copy);
    //     let length = written ?? 0;
    //     actualArgs.push(offset, length);
    //     offset += length;
    //   } else {
    //     let length = arg.byteLength;
    //     actualArgs.push(offset, length);
    //     let copy = new Uint8Array(memory.buffer, offset, length);
    //     if (ArrayBuffer.isView(arg)) {
    //       if (arg instanceof Uint8Array) {
    //         copy.set(arg);
    //       } else {
    //         copy.set(new Uint8Array(arg.buffer));
    //       }
    //     } else {
    //       copy.set(new Uint8Array(arg));
    //     }
    //     offset += length;
    //   }
    // }
    try {
      let result = func(...actualArgs);
      return lift(result, instance);
    } catch (err) {
      console.error(err);
    } finally {
      free();
      if (memory.buffer.byteLength >= 1e7) {
        console.warn(
          "Cleaning up Wasm instance, memory limit of 10MB was exceeded."
        );
        queueMicrotask(() => {
          wrapper.instancePromise = undefined;
        });
      }
    }
  };
}

function lower(value, instance) {
  let { alloc, memory } = instance.exports;
  switch (typeof value) {
    case "number":
      return value;
    case "string": {
      let pointer = alloc(4 + 2 * value.length) + 4;
      let copy = new Uint8Array(memory.buffer, pointer, 2 * value.length);
      let { written } = encoder.encodeInto(value, copy);
      let length = written ?? 0;
      let view = new DataView(memory.buffer, pointer - 4, 4);
      view.setInt32(0, length, true);
      return pointer;
    }
    case "object": {
      let isTypedArray = ArrayBuffer.isView(value);
      if (isTypedArray || value instanceof ArrayBuffer) {
        let length = value.byteLength;
        let pointer = alloc(4 + length) + 4;
        let uint8value = isTypedArray
          ? value instanceof Uint8Array
            ? value
            : new Uint8Array(value.buffer)
          : new Uint8Array(value);
        let copy = new Uint8Array(memory.buffer, pointer, length);
        copy.set(uint8value);
        let view = new DataView(memory.buffer, pointer - 4, 4);
        view.setInt32(0, length, true);
        return pointer;
      } else {
        throw Error("lowering value not supported");
      }
    }
    default:
      throw Error("lowering value not supported");
  }
}

function lift(value, instance) {
  if (value === undefined) return undefined;
  let { memory } = instance.exports;
  return readValue({
    memory,
    view: new DataView(memory.buffer, value, 1024),
    offset: 0,
  });
}

function readValue(context) {
  let { memory, offset, view } = context;
  let type = view.getUint8(offset++);
  let value;
  switch (type) {
    case 0:
      value = view.getInt32(offset, true);
      offset += 4;
      break;
    case 1:
      value = view.getFloat64(offset, true);
      offset += 8;
      break;
    case 2:
      value = !!view.getUint8(offset++);
      break;
    case 3:
    case 4: {
      let pointer2 = view.getUint32(offset, true);
      offset += 4;
      let length = view.getUint32(offset, true);
      offset += 4;
      if (type === 3)
        value = new Uint8Array(
          memory.buffer.slice(pointer2, pointer2 + length)
        );
      else
        value = decoder.decode(new Uint8Array(memory.buffer, pointer2, length));
      break;
    }
    case 5:
    case 6: {
      let length = view.getUint8(offset++);
      value = new Array(length);
      context.offset = offset;
      for (let i = 0; i < length; i++) {
        value[i] = readValue(context);
      }
      if (type === 6) value = Object.fromEntries(value);
      break;
    }
  }
  context.offset = offset;
  return value;
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
