import { getColorForElevation } from '../utils/colorMapping';
import { ProcessedElevationData } from '../utils/elevationProcessor';

import {
  Vec3Array,
  ColorArray,
  QuadVertices,
  createVec3,
  quadToTriangles,
  createMeshVertex,
} from './utils3D';

export class Topo3DRenderer {
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | null = null;
  private device: GPUDevice | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private colorBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private dimensions: { width: number; height: number } | null = null;
  private vertexCount: number = 0;
  private elevationScale: number = 0.1;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error(`Canvas with id ${canvasId} not found`);
    }
  }

  async initialize(): Promise<boolean> {
    try {
      // Get WebGPU adapter and device
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        throw new Error('No WebGPU adapter found');
      }

      this.device = await adapter.requestDevice();
      this.context = this.canvas.getContext('webgpu');

      if (!this.context) {
        throw new Error('Could not get WebGPU context');
      }

      // Configure the swap chain
      const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: canvasFormat,
        alphaMode: 'premultiplied',
      });

      this.uniformBuffer = this.device.createBuffer({
        size: 4, // Just one float (4 bytes) for elevation scale
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const initialScale = new Float32Array([this.elevationScale]);
      this.device.queue.writeBuffer(
        this.uniformBuffer,
        0,
        initialScale.buffer,
        initialScale.byteOffset,
        initialScale.byteLength
      );

      // Create bind group layout
      const bindGroupLayout = this.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
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

      // Create the render pipeline
      this.pipeline = this.device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module: this.device.createShaderModule({
            code: `
                struct VertexOutput {
                    @builtin(position) position: vec4f,
                    @location(0) color: vec3f,
                }

                struct Uniforms {
                    elevationScale: f32
                }
                @binding(0) @group(0) var<uniform> uniforms: Uniforms;

                @vertex
                fn main(
                    @location(0) position: vec3f,
                    @location(1) color: vec3f
                ) -> VertexOutput {
                    var output: VertexOutput;
                    
                    output.position = vec4f(
                        position.x,
                        -position.y + position.z * uniforms.elevationScale,
                        0.5,
                        1.0
                    );
                    output.color = color;
                    return output;
                }
                `,
          }),
          entryPoint: 'main',
          buffers: [
            {
              arrayStride: 12,
              attributes: [
                {
                  shaderLocation: 0,
                  offset: 0,
                  format: 'float32x3',
                },
              ],
            },
            {
              // Color (r,g,b)
              arrayStride: 12,
              attributes: [
                {
                  shaderLocation: 1,
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
                    @fragment
                    fn main(@location(0) color: vec3f) -> @location(0) vec4f {
                        return vec4f(color, 1.0);
                    }
                `,
          }),
          entryPoint: 'main',
          targets: [
            {
              format: canvasFormat,
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }
  }

  setupGeometry(data: ProcessedElevationData) {
    if (!this.device) return;

    this.dimensions = data.dimensions;
    const width = this.dimensions.width;
    const height = this.dimensions.height;

    const vertices: Vec3Array = [];
    const colors: ColorArray = [];

    this.vertexCount = 6 * (width - 1) * (height - 1);

    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const x1 = (x / (width - 1)) * 2 - 1;
        const x2 = ((x + 1) / (width - 1)) * 2 - 1;
        const y1 = (y / (height - 1)) * 2 - 1;
        const y2 = ((y + 1) / (height - 1)) * 2 - 1;

        const quad: QuadVertices = {
          topLeft: createMeshVertex(
            createVec3(x1, y1, data.normalizedElevations[y * width + x]),
            getColorForElevation(data.normalizedElevations[y * width + x])
          ),
          topRight: createMeshVertex(
            createVec3(x2, y1, data.normalizedElevations[y * width + (x + 1)]),
            getColorForElevation(data.normalizedElevations[y * width + (x + 1)])
          ),
          bottomLeft: createMeshVertex(
            createVec3(x1, y2, data.normalizedElevations[(y + 1) * width + x]),
            getColorForElevation(data.normalizedElevations[(y + 1) * width + x])
          ),
          bottomRight: createMeshVertex(
            createVec3(
              x2,
              y2,
              data.normalizedElevations[(y + 1) * width + (x + 1)]
            ),
            getColorForElevation(
              data.normalizedElevations[(y + 1) * width + (x + 1)]
            )
          ),
        };

        const triangleVertices = quadToTriangles(quad);
        triangleVertices.forEach((vertex) => {
          vertices.push(vertex.position);
          colors.push(vertex.color);
        });
      }
    }

    this.vertexBuffer = this.device.createBuffer({
      size: vertices.length * 3 * 4, // 3 numbers per Vec3, 4 bytes per float
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    console.log('First few vertices:', vertices.slice(0, 9));
    // Flatten here
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
      !this.dimensions ||
      !this.bindGroup
    ) {
      return;
    }

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setVertexBuffer(1, this.colorBuffer);
    renderPass.draw(this.vertexCount);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}
