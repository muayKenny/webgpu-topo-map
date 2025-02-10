import init, * as wasm from '../wasm/pkg/mesh_compute.js';
import { MeshData } from './renderer/geometry/MeshGenerator.js';

export const wasmReady = init().then(() => {
  // console.log("🚀 WASM wasm'ing up!");
  return wasm;
});

export async function mesh_compute(
  elevations: Float32Array,
  width: number,
  height: number,
  tessellationFactor: number
): Promise<MeshData> {
  const instance = await wasmReady;

  // ✅ Store the result first (don't destructure yet)
  const result = instance.mesh_compute(
    elevations,
    width,
    height,
    tessellationFactor
  );

  // ✅ Extract data before freeing memory
  const meshData = {
    vertices: result.vertices,
    colors: result.colors,
    normals: result.normals,
    vertexCount: result.vertex_count,
  };

  // ✅ Call `free()` on the original object
  result.free();

  return meshData; // ✅ Returns only the extracted JS-safe data
}

export default wasm;
