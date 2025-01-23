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