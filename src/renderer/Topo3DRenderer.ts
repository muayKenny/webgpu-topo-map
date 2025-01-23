import { ProcessedElevationData } from '../utils/elevationProcessor';

import { MeshGenerator } from './geometry/MeshGenerator';
import { PipelineBuilder } from './pipeline/Pipeline';

import vertexShader from './pipeline/vertex.wgsl?raw';
import fragmentShader from './pipeline/fragment.wgsl?raw';

export class Topo3DRenderer {
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | null = null;
  private device: GPUDevice | null = null;
  private pipeline: GPURenderPipeline | null = null;
  private vertexShader: string;
  private fragmentShader: string;
  private vertexBuffer: GPUBuffer | null = null;
  private colorBuffer: GPUBuffer | null = null;
  private normalBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private vertexCount: number = 0;
  private elevationScale: number = 0.1;

  // New parameters for enhanced visuals
  // private useNormalMapping: boolean = true;
  private ambientLight: number = 0.2;
  private diffuseStrength: number = 0.7;
  private specularStrength: number = 0.3;
  private shininess: number = 32.0;
  private meshGenerator: MeshGenerator;

  constructor(canvasId: string, meshGenerator: MeshGenerator) {
    this.vertexShader = vertexShader;
    this.fragmentShader = fragmentShader;
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

      const bindGroupLayout = this.device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' },
          },
        ],
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

      const pipelineBuilder = new PipelineBuilder(this.device, canvasFormat);
      this.pipeline = pipelineBuilder
        .setPipelineLayout(bindGroupLayout)
        .setVertexShader(this.vertexShader)
        .setFragmentShader(this.fragmentShader)
        .build();

      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }
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
