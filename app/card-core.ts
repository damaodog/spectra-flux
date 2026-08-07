export type CardConfig = {
  title: string;
  subtitle: string;
  label: string;
  colorA: string;
  colorB: string;
  seed: number;
  speed: number;
  intensity: number;
  radius: number;
  width: number;
  height: number;
  variant: number;
};

export const DEFAULT_CARD_WIDTH = 400;
export const DEFAULT_CARD_HEIGHT = 100;
export const SMOKE_VARIANT_COUNT = 6;
export const SMOKE_TIME_SCALE = 8;

export const VERTEX_SHADER = `#version 300 es
in vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform vec2 viewportOrigin;
uniform float time;
uniform float seed;
uniform float intensity;
uniform int variant;
uniform vec3 colorA;
uniform vec3 colorB;
out vec4 outColor;

float hash(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7)) + seed) * 43758.5453123);
}

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p){
  float value = 0.0;
  float amplitude = 0.5;
  for(int i = 0; i < 4; i++){
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(8.1, 3.7);
    amplitude *= 0.5;
  }
  return value;
}

vec2 vortexWarp(vec2 point, vec2 center, float spin, float falloff){
  vec2 delta = point - center;
  float influence = exp(-dot(delta, delta) * falloff);
  return vec2(-delta.y, delta.x) * spin * influence;
}

void main(){
  vec2 localFragCoord = gl_FragCoord.xy - viewportOrigin;
  vec2 uv = localFragCoord / resolution.xy;
  vec2 p = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
  float phase = seed * 0.013;
  float flowTime = time;
  float travelTime = time * 0.025;
  vec2 flowDrift = vec2(
    flowTime * 0.10,
    flowTime * 0.07
  );
  vec2 travelDrift = vec2(
    sin(travelTime + phase),
    cos(travelTime * 0.83 - phase)
  );
  vec2 macroDrift = travelDrift * 1.8;
  bool collisionFamily = variant < 2;
  bool weaveFamily = variant >= 2 && variant < 4;
  bool vortexFamily = variant >= 4;
  float fogA = fbm(p * 2.0 + flowDrift);
  float fogB = fbm(p * 3.2 + vec2(-flowDrift.y, flowDrift.x) * 0.82 + vec2(7.3));
  float fogC = 0.5;
  if(weaveFamily){
    fogC = fbm(p * 4.1 + vec2(-flowDrift.x * 0.68, flowDrift.y * 0.92) + vec2(13.7, 4.9));
  }
  vec2 warped = p + vec2(fogA - 0.5, fogB - 0.5) * 0.34;

  vec2 shape = warped;
  vec2 centerA = vec2(-0.32, 0.16) + macroDrift * vec2(0.18, 0.10);
  vec2 centerB = vec2(0.08, -0.18) + macroDrift.yx * vec2(-0.13, 0.16);
  vec2 centerC = vec2(0.78, 0.12) + macroDrift.yx * 0.14;
  vec2 centerD = vec2(0.62, -0.38) - macroDrift * 0.12;
  vec2 scaleA = vec2(0.72, 1.0);
  vec2 scaleB = vec2(0.82, 1.0);
  vec2 scaleC = vec2(0.56, 0.94);
  vec2 scaleD = vec2(0.66, 0.94);
  vec4 outer = vec4(0.62, 0.56, 0.72, 0.68);

  if(variant == 1){
    centerA = vec2(-0.08, 0.16) + macroDrift * 0.12;
    centerB = vec2(0.18, -0.10) - macroDrift.yx * 0.10;
    centerC = vec2(0.52, 0.18) + macroDrift.yx * 0.11;
    centerD = vec2(0.70, -0.16) - macroDrift * 0.10;
    scaleA = vec2(0.58, 0.90);
    scaleB = vec2(0.62, 0.88);
    scaleC = vec2(0.54, 0.86);
    scaleD = vec2(0.58, 0.88);
    outer = vec4(0.76, 0.72, 0.78, 0.74);
  }
  if(variant == 2){
    shape = vec2(
      warped.x + sin(warped.y * 3.8 + flowTime * 0.24 + phase) * 0.16,
      warped.y
    );
    centerA = vec2(-0.10, 0.40);
    centerB = vec2(0.18, 0.14);
    centerC = vec2(0.55, -0.12);
    centerD = vec2(0.88, -0.38);
    scaleA = scaleB = scaleC = scaleD = vec2(0.46, 1.72);
    outer = vec4(0.58, 0.56, 0.60, 0.58);
  }
  if(variant == 3){
    shape += normalize(shape + vec2(0.001)) * (fogB - 0.5) * 0.30;
    centerA = vec2(-0.02, 0.08) + macroDrift * 0.10;
    centerB = vec2(0.28, -0.14) - macroDrift.yx * 0.10;
    centerC = vec2(0.58, 0.22) + macroDrift.yx * 0.12;
    centerD = vec2(0.82, -0.20) - macroDrift * 0.08;
    scaleA = vec2(0.82, 0.82);
    scaleB = vec2(0.74, 0.78);
    scaleC = vec2(0.68, 0.72);
    scaleD = vec2(0.72, 0.76);
    outer = vec4(0.70, 0.58, 0.66, 0.54);
  }
  if(variant == 4){
    shape = mat2(0.94, -0.34, 0.34, 0.94) * warped;
    centerA = vec2(-0.20, 0.34) + macroDrift * 0.10;
    centerB = vec2(0.12, 0.08) - macroDrift.yx * 0.11;
    centerC = vec2(0.48, -0.16) + macroDrift * 0.12;
    centerD = vec2(0.84, -0.38) - macroDrift.yx * 0.10;
    scaleA = scaleB = scaleC = scaleD = vec2(0.58, 1.10);
    outer = vec4(0.66, 0.62, 0.70, 0.66);
  }
  if(variant == 5){
    shape = warped + vec2((fogA - 0.5) * 0.42, (fogB - 0.5) * 0.18);
    centerA = vec2(-0.08, 0.06) + macroDrift * 0.06;
    centerB = vec2(0.62, -0.02) - macroDrift.yx * 0.07;
    centerC = vec2(0.38, 0.30) + macroDrift.yx * 0.16;
    centerD = vec2(0.84, -0.30) - macroDrift * 0.14;
    scaleA = vec2(0.38, 0.66);
    scaleB = vec2(0.42, 0.70);
    scaleC = vec2(0.92, 1.18);
    scaleD = vec2(0.86, 1.12);
    outer = vec4(0.92, 0.88, 0.52, 0.48);
  }

  if(collisionFamily){
    float impact = fogA - fogB;
    shape += vec2(impact * (variant == 0 ? 0.42 : 0.30), (fogA + fogB - 1.0) * 0.18);
  }
  if(weaveFamily){
    vec2 braid = vec2(fogC - fogB, fogA - fogC);
    shape += braid * (variant == 2 ? 0.34 : 0.43);
  }
  if(vortexFamily){
    vec2 primaryCenter = variant == 4 ? vec2(0.20, 0.02) : vec2(0.44, 0.08);
    vec2 vortexFlow = vortexWarp(shape, primaryCenter, 0.82 + fogA * 0.34, 0.72);
    if(variant == 5){
      vortexFlow += vortexWarp(shape, vec2(0.92, -0.20), -0.72 - fogB * 0.28, 1.05);
      vortexFlow += vortexWarp(shape, vec2(-0.18, 0.28), 0.44, 1.30);
    }
    shape += vortexFlow + vec2(fogA - fogB, fogB - 0.5) * 0.16;
  }

  float horizontalScale = 1.0 / 1.4;
  scaleA.x *= horizontalScale;
  scaleB.x *= horizontalScale;
  scaleC.x *= horizontalScale;
  scaleD.x *= horizontalScale;

  float cloudA = 1.0 - smoothstep(0.08, outer.x, length((shape - centerA) * scaleA));
  float cloudB = 1.0 - smoothstep(0.08, outer.y, length((shape - centerB) * scaleB));
  float cloudC = 1.0 - smoothstep(0.08, outer.z, length((shape - centerC) * scaleC));
  float cloudD = 1.0 - smoothstep(0.08, outer.w, length((shape - centerD) * scaleD));

  float leftFade = smoothstep(0.01, 0.34, uv.x + fogA * 0.08);
  float detailC = weaveFamily ? fogC : fogB;
  float layerAlphaA = smoothstep(0.02, 0.82, cloudA) * leftFade * (0.74 + fogA * 0.26);
  float layerAlphaB = smoothstep(0.02, 0.82, cloudB) * leftFade * (0.72 + fogB * 0.28);
  float layerAlphaC = smoothstep(0.02, 0.82, cloudC) * leftFade * (0.76 + detailC * 0.24);
  float layerAlphaD = smoothstep(0.02, 0.82, cloudD) * leftFade * (0.74 + mix(fogA, detailC, 0.5) * 0.26);
  float smokeDensity = max(max(layerAlphaA, layerAlphaB), max(layerAlphaC, layerAlphaD));
  float strength = (collisionFamily ? 0.60 : 0.48) + intensity * 0.30;

  vec3 color = vec3(0.985);
  color = mix(color, colorA, layerAlphaA * strength);
  color = mix(color, colorB, layerAlphaB * strength);
  color = mix(color, mix(colorA, colorB, 0.30), layerAlphaC * strength * 0.88);
  color = mix(color, mix(colorA, colorB, 0.72), layerAlphaD * strength * 0.84);

  float fieldA = max(layerAlphaA, layerAlphaC);
  float fieldB = max(layerAlphaB, layerAlphaD);
  float overlapInk = min(fieldA, fieldB);
  float collisionMask = smoothstep(0.12, 0.68, overlapInk);
  float fusionMask = (1.0 - smoothstep(0.02, 0.26, abs(fieldA - fieldB))) * smokeDensity;
  float pairwiseWeave = max(min(layerAlphaA, layerAlphaB), max(min(layerAlphaB, layerAlphaC), min(layerAlphaC, layerAlphaA)));
  float threeWayWeave = min(layerAlphaA, min(layerAlphaB, layerAlphaC));

  vec3 mixedInk = mix(colorA, colorB, 0.50);
  float mixedLight = dot(mixedInk, vec3(0.299, 0.587, 0.114));
  vec3 collisionInk = clamp(mix(vec3(mixedLight * 0.78), mixedInk, 1.42), 0.0, 1.0);

  if(collisionFamily){
    color = mix(color, mix(colorA, colorB, 0.50 + (fogA - fogB) * 0.18), fusionMask * 0.20);
    color = mix(color, collisionInk, collisionMask * (0.22 + intensity * 0.26));
  }
  if(weaveFamily){
    vec3 braidColor = mix(mix(colorA, colorB, fogC), collisionInk, 0.22);
    color = mix(color, braidColor, pairwiseWeave * 0.20);
    color = mix(color, collisionInk * 0.88, threeWayWeave * (0.20 + intensity * 0.16));
  }
  if(vortexFamily){
    float filament = smoothstep(0.12, 0.62, abs(fogA - fogB)) * smokeDensity;
    color = mix(color, mix(colorA, colorB, fogA), filament * 0.16);
    color = mix(color, collisionInk, collisionMask * 0.18);
  }

  color = mix(vec3(0.985), color, 0.88 + smokeDensity * 0.12);
  outColor = vec4(color, 1.0);
}`;

const palettes = [
  ["#ff896f", "#788dff"],
  ["#75d8ff", "#6b63ff"],
  ["#f2d95c", "#aa7cff"],
  ["#64e0c1", "#2778ff"],
  ["#ff7eb8", "#ffb45e"],
  ["#a8d8ff", "#8a78d7"],
] as const;

export function createPreset(seed: number) {
  let value = seed >>> 0;
  const random = () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
  const colors = palettes[Math.floor(random() * palettes.length)];
  return {
    colorA: colors[0],
    colorB: colors[1],
    speed: Number((0.45 + random() * 1.15).toFixed(2)),
    intensity: Number((0.45 + random() * 0.5).toFixed(2)),
  };
}

export function createGallery(seed: number) {
  return Array.from({ length: SMOKE_VARIANT_COUNT }, (_, variant) => {
    const cardSeed = (seed + Math.imul(variant + 1, 0x9e3779b1)) >>> 0;
    return { ...createPreset(cardSeed), seed: cardSeed, variant };
  });
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export const toShaderSeed = (seed: number) =>
  Math.trunc(clamp(seed, 0, 4294967295)) % 65536;

const safeColor = (value: string, fallback: string) =>
  /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

export function hexToRgb(value: string): [number, number, number] {
  const color = safeColor(value, "#ffffff");
  return [1, 3, 5].map((start) => parseInt(color.slice(start, start + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );

export function buildEmbed(config: CardConfig) {
  const colorA = safeColor(config.colorA, "#ff896f");
  const colorB = safeColor(config.colorB, "#788dff");
  const [aR, aG, aB] = hexToRgb(colorA);
  const [bR, bG, bB] = hexToRgb(colorB);
  const seed = toShaderSeed(config.seed);
  const speed = clamp(config.speed, 0, 2);
  const intensity = clamp(config.intensity, 0, 1);
  const radius = clamp(config.radius, 24, 96);
  const width = clamp(config.width, 480, 1600);
  const height = clamp(config.height, 220, 900);
  const variantValue = Math.trunc(clamp(config.variant, 0, SMOKE_VARIANT_COUNT - 1));
  const vertex = JSON.stringify(VERTEX_SHADER);
  const fragment = JSON.stringify(FRAGMENT_SHADER);

  return `<div data-luma-card style="--luma-a:${colorA};--luma-b:${colorB};--luma-radius:${radius}px;--luma-width:${width}px;--luma-height:${height}px">
  <style>
    [data-luma-card]{width:min(100%,var(--luma-width));aspect-ratio:${width}/${height};display:grid;grid-template-columns:35% 65%;overflow:hidden;border:1px solid #dedfe3;border-radius:var(--luma-radius);background:#fff;color:#17181c;box-shadow:0 16px 50px rgba(22,24,30,.08);font-family:Arial,sans-serif}
    [data-luma-card] .luma-card__copy{display:flex;flex-direction:column;justify-content:center;padding:clamp(18px,4vw,40px);box-sizing:border-box}
    [data-luma-card] .luma-card__label{font:600 10px/1.2 monospace;letter-spacing:.16em;color:#8b8d95}
    [data-luma-card] h2{margin:16px 0 10px;font-size:clamp(30px,4vw,64px);line-height:.9;letter-spacing:-.065em}
    [data-luma-card] p{margin:0;max-width:19em;font-size:clamp(12px,1.2vw,16px);line-height:1.45}
    [data-luma-card] .luma-card__visual{position:relative;min-height:0;background:radial-gradient(circle at 80% 20%,var(--luma-a),transparent 48%),linear-gradient(135deg,#fff,var(--luma-b))}
    [data-luma-card] canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
  </style>
  <div class="luma-card__copy">
    <span class="luma-card__label">${escapeHtml(config.label)}</span>
    <h2>${escapeHtml(config.title)}</h2>
    <p>${escapeHtml(config.subtitle)}</p>
  </div>
  <div class="luma-card__visual"><canvas aria-hidden="true"></canvas></div>
</div>
<script>(()=>{
  const root=document.currentScript?.previousElementSibling;
  if(!root)return;
  const canvas=root.querySelector("canvas");
  const gl=canvas.getContext("webgl2",{antialias:false,alpha:false});
  if(!gl)return;
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||"Shader error");return shader};
  try{
    const program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,${vertex}));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,${fragment}));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||"Link error");
    gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,"position");gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const resolution=gl.getUniformLocation(program,"resolution"),time=gl.getUniformLocation(program,"time"),seed=gl.getUniformLocation(program,"seed"),intensity=gl.getUniformLocation(program,"intensity"),variant=gl.getUniformLocation(program,"variant"),a=gl.getUniformLocation(program,"colorA"),b=gl.getUniformLocation(program,"colorB");
    const resize=()=>{const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));gl.viewport(0,0,canvas.width,canvas.height)};
    new ResizeObserver(resize).observe(canvas);resize();
    const draw=(now=0)=>{gl.uniform2f(resolution,canvas.width,canvas.height);gl.uniform1f(time,now*.001*${speed}*${SMOKE_TIME_SCALE});gl.uniform1f(seed,${seed}.0);gl.uniform1f(intensity,${intensity});gl.uniform1i(variant,${variantValue});gl.uniform3f(a,${aR},${aG},${aB});gl.uniform3f(b,${bR},${bG},${bB});gl.drawArrays(gl.TRIANGLE_STRIP,0,4)};
    let frame=0;const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loop=(now)=>{if(!root.isConnected)return;draw(now);frame=requestAnimationFrame(loop)};
    const start=()=>{if(!frame&&!document.hidden&&!reduced)frame=requestAnimationFrame(loop)};
    const stop=()=>{cancelAnimationFrame(frame);frame=0};
    document.addEventListener("visibilitychange",()=>document.hidden?stop():start());
    draw();start();
  }catch(error){console.warn("Luma card WebGL fallback",error)}
})();</script>`;
}
