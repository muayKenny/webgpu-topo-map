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

---

## How it Works

- Generates a **triangle mesh** from elevation points.
- Colors vertices based on elevation height values.
- Configures and uses a WebGPU rendering pipeline:
  - Vertex and fragment shaders process and display data.
  - 3D view applies vertical scaling for exaggerated terrain visualization.

---

## Roadmap

### **Refactor: Modular Design**

The codebase is undergoing a refactor to improve maintainability and scalability, recently completed:

- **PipelineBuilder Class:**
  - Handles low-level GPU pipeline configuration, separating concerns from rendering logic.
- **MeshGenerator Class:**
  - Processes elevation data into a structured triangle mesh with vertices, normals, and colors.

### **Parameterizing Rendering Methods**

- Introduce configurable rendering methods for smooth shading, flat shading, and other techniques.
- Parameterize:
  - Elevation scale adjustments.
  - Mesh resolution and tessellation settings.
  - Color-mapping modes for terrain visualization.

### **Interactive Controls with React + Zustand**

- Replace existing static controls with a **React-based UI** for better interactivity and scalability.
- Use **Zustand** for state management:
  - Elevation scale adjustment.
  - Shading method selection (e.g., flat vs. smooth).
  - Toggle between 2D and 3D views.
  - Loading and displaying custom TIFF files.

---
