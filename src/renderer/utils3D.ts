export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Vec3Array = Array<Vec3>;

export interface Color {
  r: number;
  g: number;
  b: number;
}

export type ColorArray = Array<Color>;

export interface Vertex {
  position: Vec3;
  color: Color;
}

export interface GridPoint {
  position: Vec3;
  color: Color;
}

export interface QuadVertices {
  topLeft: GridPoint;
  topRight: GridPoint;
  bottomLeft: GridPoint;
  bottomRight: GridPoint;
}

// Helper functions to make code more readable
export const createVec3 = (x: number, y: number, z: number): Vec3 => ({
  x,
  y,
  z,
});

export const createGridPoint = (position: Vec3, color: Color): GridPoint => ({
  position,
  color,
});

// Convert vertex data to Float32Array format for WebGPU
export const vertexToFloat32Array = (vertex: Vertex): number[] => [
  vertex.position.x,
  vertex.position.y,
  vertex.position.z,
];

export const colorToFloat32Array = (color: Color): number[] => [
  color.r,
  color.g,
  color.b,
];

// Create two triangles from a quad (for grid cells)
export const quadToTriangles = (quad: QuadVertices): Vertex[] => [
  // First triangle
  { position: quad.topLeft.position, color: quad.topLeft.color },
  { position: quad.topRight.position, color: quad.topRight.color },
  { position: quad.bottomLeft.position, color: quad.bottomLeft.color },
  // Second triangle
  { position: quad.topRight.position, color: quad.topRight.color },
  { position: quad.bottomRight.position, color: quad.bottomRight.color },
  { position: quad.bottomLeft.position, color: quad.bottomLeft.color },
];
