import * as THREE from 'three';

export function createSkyboxMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTopColor: { value: new THREE.Color(0x0b1d4a) },
      uHorizonColor: { value: new THREE.Color(0x4b89dc) },
      uBottomColor: { value: new THREE.Color(0x1e293b) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uBottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 col = mix(uHorizonColor, uTopColor, smoothstep(0.0, 0.55, max(h, 0.0)));
        col = mix(col, uBottomColor, smoothstep(0.0, -0.25, min(h, 0.0)));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function createStormWallMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x9333ea) },
      uEdgeColor: { value: new THREE.Color(0xe879f9) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uEdgeColor;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        float wave1 = sin(vWorldPos.x * 0.25 + uTime * 2.2) * cos(vWorldPos.z * 0.25 - uTime * 1.7);
        float wave2 = sin(vWorldPos.y * 0.6 - uTime * 3.5);
        float pattern = smoothstep(0.15, 0.9, (wave1 + wave2) * 0.5 + 0.5);
        vec3 col = mix(uColor, uEdgeColor, pattern * 0.65);
        float alpha = 0.28 + pattern * 0.22;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

export function createBlueprintMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uValid: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uValid;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vec3 validCol = vec3(0.05, 0.72, 0.98);
        vec3 invalidCol = vec3(0.95, 0.18, 0.22);
        vec3 col = mix(invalidCol, validCol, uValid);
        float scan = sin(vWorldPos.y * 12.0 - uTime * 6.0) * 0.5 + 0.5;
        float grid = step(0.92, fract(vUv.x * 4.0)) + step(0.92, fract(vUv.y * 4.0));
        float alpha = 0.34 + scan * 0.14 + min(grid, 1.0) * 0.25;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
      }
    `,
  });
}
