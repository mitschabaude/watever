import {wrap} from '../src/wrap-wasm.js';
import {log} from './inner-imports.js';
let wasm = "AGFzbQEAAAABGAVgAn9/AGAAAGABfwF/YAJ/fwF/YAF/AAI+AgJqcxBjb25zb2xlLmxvZyNsaWZ0AAASLi9pbm5lci1pbXBvcnRzLmpzEWxvZyNpbnN0YW5jZSxsaWZ0AAADCQgBAgICAwIEAgUDAQABBhUEfwBBCwt/AUEAC38AQQALfwBBBAsHHwQDc3VtAAkGbWVtb3J5AgAFYWxsb2MAAwRmcmVlAAIIAQIKuwEIBgAjACQBCyYBAn8jASEBIwEgAGokASMBQRB2QQFqIgI/AEsEQCACQAAaCyABCwoAIABBBGsoAgALCgAjAhAHIAAQCAsOACMDEAcgABAIIAEQCAsRAQF/QQEQAyIBIAEgADoAAAsLAEEEEAMgADYCAAtIAQN/IAAQBCEDQQBBBxAGIAMQBRAAQQAhAkEAIQEDQCAAIAFqLQAAIAJqIQIgAUEBaiIBIANJDQALQQdBBBAGIAIQBRABIAILCxYCAEEACwdsZW5ndGg6AEEHCwRzdW06";
let {sum, memory, alloc, free} = wrap(wasm, ["sum","memory","alloc","free"], { './inner-imports.js': {'log#instance,lift': log},'js': {'console.log#lift': 'console.log'}, });
export {sum, memory, alloc, free};
