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
};

export const VERTEX_SHADER = `#version 300 es
in vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float seed;
uniform float intensity;
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

void main(){
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 p = (uv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
  float phase = seed * 0.013;
  vec2 smokeDrift = vec2(
    sin(time * 0.42 + phase),
    cos(time * 0.34 - phase)
  );
  float fogA = fbm(p * 2.0 + smokeDrift * 0.32);
  float fogB = fbm(p * 3.2 - smokeDrift.yx * 0.25 + vec2(7.3));
  vec2 warped = p + vec2(fogA - 0.5, fogB - 0.5) * 0.34;
  vec2 centerA = vec2(-0.32, 0.16) + smokeDrift * vec2(0.18, 0.10);
  vec2 centerB = vec2(0.08, -0.18) + smokeDrift.yx * vec2(-0.13, 0.16);
  vec2 centerC = vec2(0.78, 0.12) + vec2(
    sin(time * 0.29 - phase),
    cos(time * 0.37 + phase)
  ) * 0.14;
  vec2 centerD = vec2(0.62, -0.38) + vec2(
    cos(time * 0.31 + phase),
    sin(time * 0.27)
  ) * 0.12;
  float cloudA = 1.0 - smoothstep(
    0.12,
    0.62,
    length((warped - centerA) * vec2(0.72, 1.0))
  );
  float cloudB = 1.0 - smoothstep(
    0.10,
    0.56,
    length((warped - centerB) * vec2(0.82, 1.0))
  );
  float cloudC = 1.0 - smoothstep(
    0.10,
    0.72,
    length((warped - centerC) * vec2(0.56, 0.94))
  );
  float cloudD = 1.0 - smoothstep(
    0.10,
    0.68,
    length((warped - centerD) * vec2(0.66, 0.94))
  );
  float cloudBody = max(max(cloudA, cloudB), max(cloudC, cloudD));
  float smokeDensity = clamp(
    cloudBody * (0.54 + fogA * 0.32 + fogB * 0.18),
    0.0,
    1.0
  );
  float cloudTotal = cloudA + cloudB + cloudC + cloudD + 0.001;
  float cloudColor = (cloudA * 0.08 + cloudB * 0.34 +
    cloudC * 0.88 + cloudD * 0.62) / cloudTotal;
  float colorMix = clamp(cloudColor * 0.78 + uv.y * 0.10 + fogB * 0.18, 0.0, 1.0);
  vec3 smokeColor = mix(colorA, colorB, colorMix);
  float leftFade = smoothstep(0.03, 0.46, uv.x + fogA * 0.08);
  float opacity = smoothstep(0.04, 0.84, smokeDensity) *
    leftFade * (0.68 + intensity * 0.32);
  vec3 color = mix(vec3(0.985), smokeColor, opacity * 0.82);
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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

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
  const seed = Math.trunc(clamp(config.seed, 0, 4294967295));
  const speed = clamp(config.speed, 0, 2);
  const intensity = clamp(config.intensity, 0, 1);
  const radius = clamp(config.radius, 24, 96);
  const width = clamp(config.width, 480, 1600);
  const height = clamp(config.height, 220, 900);
  const vertex = JSON.stringify(VERTEX_SHADER);
  const fragment = JSON.stringify(FRAGMENT_SHADER);

  return `<div data-luma-card style="--luma-a:${colorA};--luma-b:${colorB};--luma-radius:${radius}px;--luma-width:${width}px;--luma-height:${height}px">
  <style>
    [data-luma-card]{width:min(100%,var(--luma-width));min-height:var(--luma-height);display:grid;grid-template-columns:35% 65%;overflow:hidden;border:1px solid #dedfe3;border-radius:var(--luma-radius);background:#fff;color:#17181c;box-shadow:0 16px 50px rgba(22,24,30,.08);font-family:Arial,sans-serif}
    [data-luma-card] .luma-card__copy{display:flex;flex-direction:column;justify-content:center;padding:clamp(28px,5vw,68px);box-sizing:border-box}
    [data-luma-card] .luma-card__label{font:600 10px/1.2 monospace;letter-spacing:.16em;color:#8b8d95}
    [data-luma-card] h2{margin:16px 0 10px;font-size:clamp(30px,4vw,64px);line-height:.9;letter-spacing:-.065em}
    [data-luma-card] p{margin:0;max-width:19em;font-size:clamp(12px,1.2vw,16px);line-height:1.45}
    [data-luma-card] .luma-card__visual{position:relative;min-height:inherit;background:radial-gradient(circle at 80% 20%,var(--luma-a),transparent 48%),linear-gradient(135deg,#fff,var(--luma-b))}
    [data-luma-card] canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
    @media(max-width:640px){[data-luma-card]{grid-template-columns:1fr;min-height:0}[data-luma-card] .luma-card__copy{min-height:190px}[data-luma-card] .luma-card__visual{min-height:260px}}
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
    const resolution=gl.getUniformLocation(program,"resolution"),time=gl.getUniformLocation(program,"time"),seed=gl.getUniformLocation(program,"seed"),intensity=gl.getUniformLocation(program,"intensity"),a=gl.getUniformLocation(program,"colorA"),b=gl.getUniformLocation(program,"colorB");
    const resize=()=>{const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));gl.viewport(0,0,canvas.width,canvas.height)};
    new ResizeObserver(resize).observe(canvas);resize();
    const draw=(now=0)=>{gl.uniform2f(resolution,canvas.width,canvas.height);gl.uniform1f(time,now*.001*${speed});gl.uniform1f(seed,${seed}.0);gl.uniform1f(intensity,${intensity});gl.uniform3f(a,${aR},${aG},${aB});gl.uniform3f(b,${bR},${bG},${bB});gl.drawArrays(gl.TRIANGLE_STRIP,0,4)};
    let frame=0;const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loop=(now)=>{if(!root.isConnected)return;draw(now);frame=requestAnimationFrame(loop)};
    const start=()=>{if(!frame&&!document.hidden&&!reduced)frame=requestAnimationFrame(loop)};
    const stop=()=>{cancelAnimationFrame(frame);frame=0};
    document.addEventListener("visibilitychange",()=>document.hidden?stop():start());
    draw();start();
  }catch(error){console.warn("Luma card WebGL fallback",error)}
})();</script>`;
}
