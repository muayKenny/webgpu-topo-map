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

export interface MeshVertex {
  position: Vec3;
  color: Color;
}

export interface QuadVertices {
  topLeft: MeshVertex;
  topRight: MeshVertex;
  bottomLeft: MeshVertex;
  bottomRight: MeshVertex;
}

// Helper functions to make code more readable
export const createVec3 = (x: number, y: number, z: number): Vec3 => ({
  x,
  y,
  z,
});

export const createMeshVertex = (position: Vec3, color: Color): MeshVertex => ({
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
