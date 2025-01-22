import { ProcessedElevationData } from '../utils/elevationProcessor';

import { MeshGenerator } from './geometry/MeshGenerator';

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
  private meshGenerator: MeshGenerator;

  constructor(canvasId: string, meshGenerator: MeshGenerator) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error(`Canvas with id ${canvasId} not found`);
    }
    this.meshGenerator = meshGenerator;
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

  setupGeometry(processed: ProcessedElevationData) {
    if (!this.device) return;

    const { vertices, colors, normals, vertexCount } =
      this.meshGenerator.generateMesh(
        processed.normalizedElevations,
        processed.dimensions.width,
        processed.dimensions.height
      );

    this.vertexCount = vertexCount;

    // Create GPU buffers
    this.vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
    this.vertexBuffer.unmap();

    this.colorBuffer = this.device.createBuffer({
      size: colors.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.colorBuffer.getMappedRange()).set(colors);
    this.colorBuffer.unmap();

    console.log('normals: ', normals.length, 'verts: ', vertices.length);

    this.normalBuffer = this.device.createBuffer({
      size: normals.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.normalBuffer.getMappedRange()).set(normals);
    this.normalBuffer.unmap();

    console.log('Geometry setup complete with', vertexCount, 'vertices');
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
