import {wrap} from '../src/wrap-wasm.js';
let wasm = "AGFzbQEAAAABDQNgAX8AYAAAYAF/AX8CEgECanMLY29uc29sZS5sb2cAAAMIBwECAgICAAIFAwEAAQYQA38AQQALfwFBAAt/AEEACwcfBANzdW0ABwZtZW1vcnkCAAVhbGxvYwACBGZyZWUAAQgBAQqeAQcGACMAJAELJgECfyMBIQEjASAAaiQBIwFBEHZBAWoiAj8ASwRAIAJAABoLIAELCgAgAEEEaygCAAsKACMCEAUgABAGCxEBAX9BARACIgEgASAAOgAACwsAQQQQAiAANgIACzoBA38gABADIQEgARAAQQAhA0EAIQIDQCAAIAJqLQAAIANqIQMgAkEBaiICIAFJDQALIAMQACADEAQL";
let {sum, memory, alloc, free} = wrap(wasm, ["sum","memory","alloc","free"], { 'js': {'console.log': 'console.log'}, });
export {sum, memory, alloc, free};
