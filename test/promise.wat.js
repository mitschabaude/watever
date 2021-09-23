import {wrap} from '../src/wrap-wasm.js';
import {promise} from './inner-imports.js';
let wasm = "AGFzbQEAAAABFwVgAX8AYAF/AX9gAABgAn9/AX9gAAF/AjkCAmpzEGNvbnNvbGUubG9nI2xpZnQAABIuL2lubmVyLWltcG9ydHMuanMMcHJvbWlzZSNsaWZ0AAEDCwoCAQEDAQEBAAQBBAQBcAABBQMBAAEGGgV/AEEFC38BQQALfwBBBAt/AEEHC38AQQgLBzIFBXRhYmxlAQAOYXN5bmNDYWxsI2xpZnQACgZtZW1vcnkCAAVhbGxvYwADBGZyZWUAAggBAgkHAQBBAAsBCwqbAQoGACMAJAELJgECfyMBIQEjASAAaiQBIwFBEHZBAWoiAj8ASwRAIAJAABoLIAELCgAgAEEEaygCAAsOACMCEAggABAJIAEQCQsKACMDEAggABAJCwoAIwQQCCAAEAkLEQEBf0EBEAMiASABIAA6AAALCwBBBBADIAA2AgALCgBBABAHEAEQBgsSACAAIAAQBBAFEABBAEEFEAULCwsBAEEACwVZRUFIIQ==";
let {table, asyncCall, memory, alloc, free} = wrap(wasm, ["table","asyncCall#lift","memory","alloc","free"], { './inner-imports.js': {'promise#lift': promise},'js': {'console.log#lift': 'console.log'}, });
export {table, asyncCall, memory, alloc, free};
