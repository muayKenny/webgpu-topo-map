import init, * as wasm from '../wasm/pkg/mesh_compute.js';

export const wasmReady = init().then(() => {
  console.log("🚀 WASM wasm'ing up!");
  return wasm;
});

// Wrapped function: Ensures WASM is ready before calling add_numbers
export async function addNumbers(a: number, b: number): Promise<number> {
  const instance = await wasmReady;
  return instance.add_numbers(a, b);
}

// Export everything else for flexibility
export default wasm;
