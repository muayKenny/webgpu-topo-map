import { getColorForElevation } from '../../utils/colorMapping';
import { Vec3 } from '../utils3D';

interface MeshData {
  vertices: Float32Array; // Flattened array of vertex positions (x, y, z)
  colors: Float32Array; // Flattened array of color values (r, g, b)
  normals: Float32Array; // Flattened array of normal vectors (x, y, z)
  vertexCount: number; // Number of vertices in the mesh
}

// Mesh Factory
export class MeshGenerator {
  private tessellationFactor: number;

  constructor(tessellationFactor: number = 1) {
    this.tessellationFactor = tessellationFactor;
  }

  generateMesh(
    elevations: Float32Array, // 1D array of elevation values
    width: number, // Original width of elevation data
    height: number // Original height of elevation data
  ): MeshData {
    // Calculate dimensions after tessellation
    const newWidth = width * this.tessellationFactor;
    const newHeight = height * this.tessellationFactor;

    // Interpolate elevation data to match tessellated dimensions
    const interpolatedElevations = this.interpolateElevations(
      elevations,
      width,
      height,
      newWidth,
      newHeight
    );

    const vertices: number[] = [];
    const colors: number[] = [];
    const normals: number[] = [];

    // Generate mesh
    for (let y = 0; y < newHeight - 1; y++) {
      for (let x = 0; x < newWidth - 1; x++) {
        // Map grid coordinates to [-1, 1] range
        const x1 = (x / (newWidth - 1)) * 2 - 1;
        const x2 = ((x + 1) / (newWidth - 1)) * 2 - 1;
        const y1 = (y / (newHeight - 1)) * 2 - 1;
        const y2 = ((y + 1) / (newHeight - 1)) * 2 - 1;

        // Get elevation values
        const z1 = interpolatedElevations[y * newWidth + x];
        const z2 = interpolatedElevations[y * newWidth + (x + 1)];
        const z3 = interpolatedElevations[(y + 1) * newWidth + x];
        const z4 = interpolatedElevations[(y + 1) * newWidth + (x + 1)];

        // Create two triangles for the quad
        const quadVertices = [
          { x: x1, y: y1, z: z1 },
          { x: x2, y: y1, z: z2 },
          { x: x1, y: y2, z: z3 },
          { x: x2, y: y2, z: z4 },
        ];

        const triangleIndices = [
          [0, 1, 2], // Triangle 1
          [1, 3, 2], // Triangle 2
        ];

        for (const indices of triangleIndices) {
          // Calculate the normal for the triangle
          const normal = this.calculateNormal(
            quadVertices[indices[0]],
            quadVertices[indices[1]],
            quadVertices[indices[2]]
          );

          // Push the normal, vertices, and colors for each vertex of the triangle
          indices.forEach((i) => {
            normals.push(normal.x, normal.y, normal.z);

            const vertex = quadVertices[i];
            vertices.push(vertex.x, vertex.y, vertex.z);

            const color = getColorForElevation(vertex.z);
            colors.push(color.r, color.g, color.b);
          });
        }
      }
    }

    return {
      vertices: new Float32Array(vertices),
      colors: new Float32Array(colors),
      normals: new Float32Array(normals),
      vertexCount: vertices.length / 3,
    };
  }

  private interpolateElevations(
    elevations: Float32Array,
    originalWidth: number,
    originalHeight: number,
    newWidth: number,
    newHeight: number
  ): number[] {
    // Bilinear interpolation
    const interpolated: number[] = [];

    const elevationsArray = Array.from(elevations);
    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const origX = (x * (originalWidth - 1)) / (newWidth - 1);
        const origY = (y * (originalHeight - 1)) / (newHeight - 1);

        const x1 = Math.floor(origX);
        const x2 = Math.min(x1 + 1, originalWidth - 1);
        const y1 = Math.floor(origY);
        const y2 = Math.min(y1 + 1, originalHeight - 1);

        const dx = origX - x1;
        const dy = origY - y1;

        const z1 = elevationsArray[y1 * originalWidth + x1];
        const z2 = elevationsArray[y1 * originalWidth + x2];
        const z3 = elevationsArray[y2 * originalWidth + x1];
        const z4 = elevationsArray[y2 * originalWidth + x2];

        interpolated.push(
          z1 * (1 - dx) * (1 - dy) +
            z2 * dx * (1 - dy) +
            z3 * (1 - dx) * dy +
            z4 * dx * dy
        );
      }
    }
    return interpolated;
  }

  private calculateNormal(v1: Vec3, v2: Vec3, v3: Vec3): Vec3 {
    // Calculate two edges
    const edge1 = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
    const edge2 = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };

    // Cross product
    const normal = {
      x: edge1.y * edge2.z - edge1.z * edge2.y,
      y: edge1.z * edge2.x - edge1.x * edge2.z,
      z: edge1.x * edge2.y - edge1.y * edge2.x,
    };

    // Normalize
    const length = Math.sqrt(
      normal.x * normal.x + normal.y * normal.y + normal.z * normal.z
    );

    return { x: normal.x / length, y: normal.y / length, z: normal.z / length };
  }
}
// this.dimensions = {
//   width: data.dimensions.width * this.tessellationFactor,
//   height: data.dimensions.height * this.tessellationFactor,
// };

// const width = this.dimensions.width;
// const height = this.dimensions.height;

// // Create higher resolution mesh by interpolating between points
// const interpolatedElevations = this.interpolateElevations(
//   Array.from(data.normalizedElevations),
//   data.dimensions.width,
//   data.dimensions.height,
//   width,
//   height
// );

// const vertices: Vec3Array = [];
// const colors: ColorArray = [];
// const normals: Vec3Array = [];

// // Each quad becomes 2 triangles (6 vertices)
// this.vertexCount = 6 * (width - 1) * (height - 1);

// for (let y = 0; y < height - 1; y++) {
//   for (let x = 0; x < width - 1; x++) {
//     const x1 = (x / (width - 1)) * 2 - 1;
//     const x2 = ((x + 1) / (width - 1)) * 2 - 1;
//     const y1 = (y / (height - 1)) * 2 - 1;
//     const y2 = ((y + 1) / (height - 1)) * 2 - 1;

//     // Get elevation values for the quad corners
//     const elevation1 = interpolatedElevations[y * width + x];
//     const elevation2 = interpolatedElevations[y * width + (x + 1)];
//     const elevation3 = interpolatedElevations[(y + 1) * width + x];
//     const elevation4 = interpolatedElevations[(y + 1) * width + (x + 1)];

//     const quad: QuadVertices = {
//       topLeft: createMeshVertex(
//         createVec3(x1, y1, elevation1),
//         getColorForElevation(elevation1)
//       ),
//       topRight: createMeshVertex(
//         createVec3(x2, y1, elevation2),
//         getColorForElevation(elevation2)
//       ),
//       bottomLeft: createMeshVertex(
//         createVec3(x1, y2, elevation3),
//         getColorForElevation(elevation3)
//       ),
//       bottomRight: createMeshVertex(
//         createVec3(x2, y2, elevation4),
//         getColorForElevation(elevation4)
//       ),
//     };

//     const triangleVertices = quadToTriangles(quad);
//     triangleVertices.forEach((vertex) => {
//       vertices.push(vertex.position);
//       colors.push(vertex.color);
//     });

//     const normal = this.calculateVertexNormal(
//       x,
//       y,
//       width,
//       height,
//       interpolatedElevations
//     );
//     // Push the same normal for all vertices in the quad (6 times for 2 triangles)
//     for (let i = 0; i < 6; i++) {
//       normals.push(normal);
//     }
//   }
// }

// private interpolateElevations(
// originalData: number[],
// originalWidth: number,
// originalHeight: number,
// newWidth: number,
// newHeight: number
// ): number[] {
// const interpolated: number[] = new Array(newWidth * newHeight);

// for (let y = 0; y < newHeight; y++) {
//   for (let x = 0; x < newWidth; x++) {
//     const origX = (x * (originalWidth - 1)) / (newWidth - 1);
//     const origY = (y * (originalHeight - 1)) / (newHeight - 1);

//     const x1 = Math.floor(origX);
//     const x2 = Math.min(x1 + 1, originalWidth - 1);
//     const y1 = Math.floor(origY);
//     const y2 = Math.min(y1 + 1, originalHeight - 1);

//     const fx = origX - x1;
//     const fy = origY - y1;

//     // Bilinear interpolation
//     const v11 = originalData[y1 * originalWidth + x1];
//     const v12 = originalData[y1 * originalWidth + x2];
//     const v21 = originalData[y2 * originalWidth + x1];
//     const v22 = originalData[y2 * originalWidth + x2];

//     interpolated[y * newWidth + x] =
//       v11 * (1 - fx) * (1 - fy) +
//       v12 * fx * (1 - fy) +
//       v21 * (1 - fx) * fy +
//       v22 * fx * fy;
//   }
// }

// return interpolated;
