import { getColorForElevation } from '../utils/colorMapping';
import { ProcessedElevationData } from '../utils/elevationProcessor';

import {
  Vec3Array,
  ColorArray,
  QuadVertices,
  createVec3,
  quadToTriangles,
  createMeshVertex,
  Vec3,
} from './utils3D';

export class Topo3DRenderer {
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | null = null;
  private device: GPUDevice | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private colorBuffer: GPUBuffer | null = null;
  private normalBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private dimensions: { width: number; height: number } | null = null;
  private vertexCount: number = 0;
  private elevationScale: number = 0.1;

  // New parameters for enhanced visuals
  private useNormalMapping: boolean = true;
  private tessellationFactor: number = 2; // Subdivide each quad into smaller pieces
  private ambientLight: number = 0.2;
  private diffuseStrength: number = 0.7;
  private specularStrength: number = 0.3;
  private shininess: number = 32.0;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error(`Canvas with id ${canvasId} not found`);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        throw new Error('No WebGPU adapter found');
      }

      this.device = await adapter.requestDevice();
      this.context = this.canvas.getContext('webgpu');

      if (!this.context) {
        throw new Error('Could not get WebGPU context');
      }

      const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: canvasFormat,
        alphaMode: 'premultiplied',
      });

      // Uniform buffer setup
      this.uniformBuffer = this.device.createBuffer({
        size: 20, // 5 float32 values * 4 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const uniformData = new Float32Array([
        this.elevationScale,
        this.ambientLight,
        this.diffuseStrength,
        this.specularStrength,
        this.shininess,
      ]);

      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

      // Create bind group layout and pipeline layout
      const bindGroupLayout = this.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' },
          },
        ],
      });

      const pipelineLayout = this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      });

      this.bindGroup = this.device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: this.uniformBuffer },
          },
        ],
      });

      // Create the render pipeline with corrected vertex layout
      this.pipeline = this.device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module: this.device.createShaderModule({
            code: `
              struct Uniforms {
                elevationScale: f32,
                ambientLight: f32,
                diffuseStrength: f32,
                specularStrength: f32,
                shininess: f32,
              }
              @binding(0) @group(0) var<uniform> uniforms: Uniforms;

              struct VertexOutput {
                @builtin(position) position: vec4f,
                @location(0) color: vec3f,
                @location(1) worldPos: vec3f,
                @location(2) normal: vec3f,
              }

              @vertex
              fn main(
                @location(0) position: vec3f,
                @location(1) color: vec3f,
                @location(2) normal: vec3f,
              ) -> VertexOutput {
                var output: VertexOutput;
                let worldPos = vec3f(
                  position.x,
                  position.y + position.z * uniforms.elevationScale,
                  position.z * uniforms.elevationScale
                );
                
                output.position = vec4f(worldPos, 1.0);
                output.color = color;
                output.worldPos = worldPos;
                output.normal = normalize(normal);
                return output;
              }
            `,
          }),
          entryPoint: 'main',
          buffers: [
            {
              // Vertex positions
              arrayStride: 12, // 3 floats * 4 bytes
              attributes: [
                {
                  shaderLocation: 0,
                  offset: 0,
                  format: 'float32x3',
                },
              ],
            },
            {
              // Colors
              arrayStride: 12, // 3 floats * 4 bytes
              attributes: [
                {
                  shaderLocation: 1,
                  offset: 0,
                  format: 'float32x3',
                },
              ],
            },
            {
              // Normals
              arrayStride: 12, // 3 floats * 4 bytes
              attributes: [
                {
                  shaderLocation: 2,
                  offset: 0,
                  format: 'float32x3',
                },
              ],
            },
          ],
        },
        fragment: {
          module: this.device.createShaderModule({
            code: `
              struct Uniforms {
                elevationScale: f32,
                ambientLight: f32,
                diffuseStrength: f32,
                specularStrength: f32,
                shininess: f32,
              }
              @binding(0) @group(0) var<uniform> uniforms: Uniforms;

              @fragment
              fn main(
                @location(0) color: vec3f,
                @location(1) worldPos: vec3f,
                @location(2) normal: vec3f,
              ) -> @location(0) vec4f {
                let lightPos = vec3f(2.0, 2.0, 4.0);
                let viewPos = vec3f(0.0, 0.0, 5.0);
                
                // Ambient
                let ambient = uniforms.ambientLight * color;
                
                // Diffuse
                let lightDir = normalize(lightPos - worldPos);
                let diff = max(dot(normal, lightDir), 0.0);
                let diffuse = uniforms.diffuseStrength * diff * color;
                
                // Specular
                let viewDir = normalize(viewPos - worldPos);
                let reflectDir = reflect(-lightDir, normal);
                let spec = pow(max(dot(viewDir, reflectDir), 0.0), uniforms.shininess);
                let specular = uniforms.specularStrength * spec * vec3f(1.0);
                
                let result = ambient + diffuse + specular;
                return vec4f(result, 1.0);
              }
            `,
          }),
          entryPoint: 'main',
          targets: [{ format: canvasFormat }],
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'back',
        },
        depthStencil: {
          depthWriteEnabled: true,
          depthCompare: 'less',
          format: 'depth24plus',
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }
  }

  private calculateNormals(
    vertices: Vec3Array,
    width: number,
    height: number
  ): Float32Array {
    const normals: number[] = [];

    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        // Calculate normals for each vertex using cross product of adjacent edges
        const p0 = vertices[y * width + x];
        const p1 = vertices[y * width + (x + 1)];
        const p2 = vertices[(y + 1) * width + x];

        const edge1 = {
          x: p1.x - p0.x,
          y: p1.y - p0.y,
          z: p1.z - p0.z,
        };

        const edge2 = {
          x: p2.x - p0.x,
          y: p2.y - p0.y,
          z: p2.z - p0.z,
        };

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

        normals.push(normal.x / length, normal.y / length, normal.z / length);
      }
    }

    return new Float32Array(normals);
  }

  private calculateVertexNormal(
    x: number,
    y: number,
    width: number,
    height: number,
    elevations: number[]
  ): Vec3 {
    // Get neighboring elevation values
    const left =
      x > 0 ? elevations[y * width + (x - 1)] : elevations[y * width + x];
    const right =
      x < width - 1
        ? elevations[y * width + (x + 1)]
        : elevations[y * width + x];
    const top =
      y > 0 ? elevations[(y - 1) * width + x] : elevations[y * width + x];
    const bottom =
      y < height - 1
        ? elevations[(y + 1) * width + x]
        : elevations[y * width + x];

    // Calculate gradient in x and y directions
    const dx = (right - left) / 2;
    const dy = (bottom - top) / 2;

    // Create normal vector (-dx, -dy, 1) and normalize it
    const length = Math.sqrt(dx * dx + dy * dy + 1);
    return createVec3(-dx / length, -dy / length, 1 / length);
  }

  setupGeometry(data: ProcessedElevationData) {
    if (!this.device) return;

    this.dimensions = {
      width: data.dimensions.width * this.tessellationFactor,
      height: data.dimensions.height * this.tessellationFactor,
    };

    const width = this.dimensions.width;
    const height = this.dimensions.height;

    // Create higher resolution mesh by interpolating between points
    const interpolatedElevations = this.interpolateElevations(
      Array.from(data.normalizedElevations),
      data.dimensions.width,
      data.dimensions.height,
      width,
      height
    );

    const vertices: Vec3Array = [];
    const colors: ColorArray = [];
    const normals: Vec3Array = [];

    // Each quad becomes 2 triangles (6 vertices)
    this.vertexCount = 6 * (width - 1) * (height - 1);

    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const x1 = (x / (width - 1)) * 2 - 1;
        const x2 = ((x + 1) / (width - 1)) * 2 - 1;
        const y1 = (y / (height - 1)) * 2 - 1;
        const y2 = ((y + 1) / (height - 1)) * 2 - 1;

        // Get elevation values for the quad corners
        const elevation1 = interpolatedElevations[y * width + x];
        const elevation2 = interpolatedElevations[y * width + (x + 1)];
        const elevation3 = interpolatedElevations[(y + 1) * width + x];
        const elevation4 = interpolatedElevations[(y + 1) * width + (x + 1)];

        const quad: QuadVertices = {
          topLeft: createMeshVertex(
            createVec3(x1, y1, elevation1),
            getColorForElevation(elevation1)
          ),
          topRight: createMeshVertex(
            createVec3(x2, y1, elevation2),
            getColorForElevation(elevation2)
          ),
          bottomLeft: createMeshVertex(
            createVec3(x1, y2, elevation3),
            getColorForElevation(elevation3)
          ),
          bottomRight: createMeshVertex(
            createVec3(x2, y2, elevation4),
            getColorForElevation(elevation4)
          ),
        };

        const triangleVertices = quadToTriangles(quad);
        triangleVertices.forEach((vertex) => {
          vertices.push(vertex.position);
          colors.push(vertex.color);
        });

        const normal = this.calculateVertexNormal(
          x,
          y,
          width,
          height,
          interpolatedElevations
        );
        // Push the same normal for all vertices in the quad (6 times for 2 triangles)
        for (let i = 0; i < 6; i++) {
          normals.push(normal);
        }
      }
    }

    // Create and set up buffers
    this.vertexBuffer = this.device.createBuffer({
      size: vertices.length * 3 * 4,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });

    const flatVertices = vertices.flatMap((v) => [v.x, v.y, v.z]);
    new Float32Array(this.vertexBuffer.getMappedRange()).set(flatVertices);
    this.vertexBuffer.unmap();

    this.colorBuffer = this.device.createBuffer({
      size: colors.length * 3 * 4,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });

    const flatColors = colors.flatMap((c) => [c.r, c.g, c.b]);
    new Float32Array(this.colorBuffer.getMappedRange()).set(flatColors);
    this.colorBuffer.unmap();

    this.normalBuffer = this.device.createBuffer({
      size: normals.length * 3 * 4,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });

    const flatNormals = normals.flatMap((n) => [n.x, n.y, n.z]);
    new Float32Array(this.normalBuffer.getMappedRange()).set(flatNormals);
    this.normalBuffer.unmap();

    console.log('Setup complete:', {
      vertexCount: this.vertexCount,
      vertices: vertices.length,
      colors: colors.length,
      normals: normals.length,
    });
  }

  private interpolateElevations(
    originalData: number[],
    originalWidth: number,
    originalHeight: number,
    newWidth: number,
    newHeight: number
  ): number[] {
    const interpolated: number[] = new Array(newWidth * newHeight);

    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const origX = (x * (originalWidth - 1)) / (newWidth - 1);
        const origY = (y * (originalHeight - 1)) / (newHeight - 1);

        const x1 = Math.floor(origX);
        const x2 = Math.min(x1 + 1, originalWidth - 1);
        const y1 = Math.floor(origY);
        const y2 = Math.min(y1 + 1, originalHeight - 1);

        const fx = origX - x1;
        const fy = origY - y1;

        // Bilinear interpolation
        const v11 = originalData[y1 * originalWidth + x1];
        const v12 = originalData[y1 * originalWidth + x2];
        const v21 = originalData[y2 * originalWidth + x1];
        const v22 = originalData[y2 * originalWidth + x2];

        interpolated[y * newWidth + x] =
          v11 * (1 - fx) * (1 - fy) +
          v12 * fx * (1 - fy) +
          v21 * (1 - fx) * fy +
          v22 * fx * fy;
      }
    }

    return interpolated;
  }

  updateElevationScale(scale: number) {
    if (!this.device || !this.uniformBuffer) return;

    this.elevationScale = scale;
    // Create a temporary buffer to hold the float value
    const tempBuffer = new Float32Array([scale]);

    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      tempBuffer.buffer,
      tempBuffer.byteOffset,
      tempBuffer.byteLength
    );

    this.render();
  }

  render() {
    if (
      !this.device ||
      !this.context ||
      !this.pipeline ||
      !this.vertexBuffer ||
      !this.colorBuffer ||
      !this.normalBuffer ||
      !this.bindGroup ||
      this.vertexCount === 0
    ) {
      console.warn('Missing required resources for rendering');
      return;
    }

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    // Create depth texture
    const depthTexture = this.device.createTexture({
      size: {
        width: this.canvas.width,
        height: this.canvas.height,
        depthOrArrayLayers: 1,
      },
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setVertexBuffer(1, this.colorBuffer);
    renderPass.setVertexBuffer(2, this.normalBuffer);
    renderPass.draw(this.vertexCount);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}
