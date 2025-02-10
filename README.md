# WebGPU Topo Map

Renders elevation data from TIFF files using WebGPU. Built from scratch with no graphics libraries.

![Topographic Map Visualization](/assets/topo-map-screenshot.png)

---

## Run it

```bash
npm install
npm run dev
```

---

## Requirements

- Chrome Canary with WebGPU flags enabled.

---

## What it Does

- Reads `/public/data/elevation.tiff`.
- Displays a color-mapped elevation view in **2D** or **3D**:
  - **2D View:** Color-mapped by elevation height (green for low elevations, brown for high).
  - **3D View:** Includes adjustable height scale to emphasize terrain features.
- Default view showcases elevation data around **Harrisburg, Pennsylvania**.
- Uses a 256x256 elevation grid stored in a TIFF file. (Supports swapping for other TIFF files of the same size.)
- Built with **Vite** and **TypeScript**.
- **New Feature:** Terrain Mesh Generation with **WASM Compute**.

---

## How it Works

- Generates a **triangle mesh** from elevation points.
- Colors vertices based on elevation height values.
- Configures and uses a WebGPU rendering pipeline:
  - Vertex and fragment shaders process and display data.
  - 3D view applies vertical scaling for exaggerated terrain visualization.

---

## WASM Terrain Generation

The original **mesh generation** was written in JavaScript. To improve efficiency, the terrain generation logic was rewritten in **Rust** and compiled to **WebAssembly (WASM)** using `wasm-bindgen` to expose Rust functions\*\* to JavaScript.

This optimization allowed some of the more computationally expensive operations—such as mesh interpolation, vertex & normal generation, and color mapping—to run in **Rust instead of JavaScript**, making it about **3x faster**!

### **Performance Gains**

| Method      | Compute Time |
| ----------- | ------------ |
| JavaScript  | ~144ms       |
| WASM (Rust) | ~50ms        |
| **Speedup** | ~3x faster   |

Measured in Chrome devtools with an m3 max.

---

## Next Steps

- **Expand visual and user-centric features**, such as more interactive controls, dynamic lighting, and real-time terrain modifications.
- Maybe look into **SIMD optimizations in Rust** or **compute shaders** to further improve performance.

For now, this optimization makes terrain mesh generation **three times faster**, making it feasible to generate high-resolution terrain in real time without major slowdowns.
