# WebGPU Topo Map

Renders elevation data from TIFF files using WebGPU. Built from scratch with no graphics libraries.

![Topographic Map Visualization](/assets/topo-map-screenshot.png)

## Run it

```bash
npm install
npm run dev
```

# Requirements

- Needs Chrome Canary with WebGPU flags enabled.

# What it does

- Reads /public/data/elevation.tiff
- Shows a color-mapped elevation view in 2D or 3D
- Colors just show elevation height (green low, brown high)
- 3D view has adjustable height scale
- Default view shows elevation around Harrisburg, Pennsylvania
- The TIFF file is a 256x256 elevation grid. You can swap in other elevation TIFF files of the same size.
- Built with Vite + TypeScript.

# How it works

- Creates a triangle mesh from the elevation points
- Colors mapped to height values
- 3D view lets you adjust the vertical scale to emphasize terrain features
