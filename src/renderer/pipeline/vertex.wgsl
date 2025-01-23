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