import { MOTION_STUDIES } from "./motion-catalog.ts";

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
  studyId: number;
  variant: number;
  kernel: number;
  params: readonly [number, number, number, number];
};

export const DEFAULT_CARD_WIDTH = 400;
export const DEFAULT_CARD_HEIGHT = 100;
export const SMOKE_VARIANT_COUNT = MOTION_STUDIES.length;
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
uniform int kernel;
uniform vec4 studyParams;
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

float band(float value, float width){
  return 1.0 - smoothstep(width, width + 0.34, abs(value));
}

float softLine(float value, float width, float feather){
  return 1.0 - smoothstep(width, width + feather, abs(value));
}

vec4 seamField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.72, 3.2 + q.x) + vec2(t * 0.08, -t * 0.04));
  float seam = p.y - sin(p.x * (1.0 + q.x) - t * 0.14) * 0.16 - (n - 0.5) * 0.28;
  float pulse = 0.5 + 0.5 * sin(t * (0.10 + q.w * 0.08));
  float upper = softLine(seam - mix(0.30, 0.10, pulse), 0.11, 0.22);
  float lower = softLine(seam + mix(0.28, 0.08, pulse), 0.11, 0.22);
  float collision = softLine(seam, 0.035, 0.08);
  return vec4(upper, lower, collision, collision * (0.45 + 0.55 * n));
}

vec4 braidField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.82, 3.8) + vec2(t * 0.09, -t * 0.04));
  float a = p.y - sin(p.x * (1.2 + q.x) - t * 0.16) * 0.22 - (n - 0.5) * 0.18;
  float b = p.y - sin(p.x * (1.7 + q.y) + t * 0.11 + 2.1) * 0.20 + (n - 0.5) * 0.16;
  float c = p.y - sin(p.x * (2.1 + q.z) - t * 0.08 + 4.2) * 0.15;
  return vec4(softLine(a, 0.08, 0.18), softLine(b, 0.08, 0.18), softLine(c, 0.045, 0.10), softLine(a - b, 0.04, 0.10));
}

vec4 wakeField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.64, 4.2) + vec2(t * 0.16, -t * 0.06));
  float coreLine = p.y - sin(p.x * (1.4 + q.x) - t * 0.28) * 0.13 - (n - 0.5) * 0.16;
  float direction = sign(q.y == 0.0 ? 1.0 : q.y);
  float upperWake = coreLine - 0.20 - direction * sin(p.x * 2.2 - t * 0.11) * 0.10;
  float lowerWake = coreLine + 0.22 + direction * sin(p.x * 1.8 + t * 0.09) * 0.09;
  return vec4(softLine(coreLine, 0.05, 0.11), softLine(upperWake, 0.10, 0.20), softLine(lowerWake, 0.10, 0.20), softLine(upperWake + lowerWake, 0.05, 0.13));
}

vec4 foldField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.70, 3.0 + q.y) + vec2(t * 0.07, -t * 0.05));
  float breath = 0.5 + 0.5 * sin(t * (0.07 + q.w * 0.05));
  float fold = p.y - sin(p.x * (1.0 + q.x) - t * 0.12) * mix(0.30, 0.12, breath) - (n - 0.5) * 0.24;
  float crest = softLine(fold, 0.035, 0.08);
  float face = softLine(fold - mix(0.34, 0.12, breath), 0.14, 0.24);
  float returnFace = softLine(fold + mix(0.30, 0.10, breath), 0.12, 0.22);
  return vec4(face, returnFace, crest, max(face, returnFace) * (0.42 + n * 0.58));
}

vec4 veilField(vec2 p, float t, vec4 q){
  float n1 = fbm(p * vec2(0.72, 3.2 + q.x) + vec2(t * 0.10, -t * 0.05));
  float n2 = fbm(p * vec2(0.94, 4.4 + q.z) + vec2(-t * 0.08, t * 0.04) + 7.0);
  float top = p.y - 0.24 - (n1 - 0.5) * (0.28 + q.y * 0.18);
  float bottom = p.y + 0.22 - (n2 - 0.5) * (0.30 + abs(q.y) * 0.16);
  return clamp(vec4(band(top, 0.20), band(bottom, 0.22), band(top + bottom, 0.18), band(top - bottom, 0.28)), 0.0, 1.0);
}

vec4 filmField(vec2 p, float t, vec4 q){
  float a = fbm(p * (1.4 + q.x * 0.5) + vec2(t * 0.07, -t * 0.04));
  float b = fbm(p.yx * (2.0 + q.y * 0.4) + vec2(-t * 0.05, t * 0.06) + 9.0);
  float edge = 1.0 - smoothstep(0.08, 0.42, abs(a - b));
  return vec4(a, b, edge, smoothstep(0.32, 0.82, a + b - 0.38));
}

vec4 lensField(vec2 p, float t, vec4 q){
  vec2 c1 = vec2(sin(t * 0.11), cos(t * 0.09)) * vec2(0.46, 0.20);
  vec2 c2 = vec2(cos(t * 0.08 + 2.0), sin(t * 0.12)) * vec2(0.62, 0.24);
  float d1 = length((p - c1) * vec2(0.66, 1.0));
  float d2 = length((p - c2) * vec2(0.72, 1.0));
  return vec4(1.0-smoothstep(0.28, 1.18, d1), 1.0-smoothstep(0.24, 1.04, d2), band(d1-q.x*0.32, 0.08), band(d2-q.z*0.28, 0.09));
}

vec4 glowField(vec2 p, float t, vec4 q){
  float curtain = sin(p.x * (1.2 + q.x) - t * 0.13) * 0.18;
  float haze = fbm(p * vec2(0.78, 2.6) + vec2(t * 0.05, 4.0));
  float coreLine = p.y - curtain - (haze - 0.5) * 0.34;
  float haloLine = p.y + curtain * 0.7 + (haze - 0.5) * 0.22;
  float core = band(coreLine, 0.10);
  float halo = band(haloLine, 0.25);
  float glowRidge = band(coreLine + sin(p.x * 3.1 - t * 0.18) * 0.06, 0.035);
  return vec4(core, halo, glowRidge, haze * halo);
}

vec4 waveField(vec2 p, float t, vec4 q){
  float w1 = sin(p.x * (1.8 + q.x) - t * 0.16) + sin(p.y * (4.0 + q.y) + t * 0.11);
  float w2 = sin(p.x * (2.4 + q.z) + t * 0.10) - sin(p.y * 3.2 - t * 0.14);
  return vec4(0.5+0.5*sin(w1), 0.5+0.5*sin(w2), 1.0-smoothstep(0.10,0.72,abs(w1-w2)), 0.5+0.5*sin(w1+w2));
}

vec4 gelField(vec2 p, float t, vec4 q){
  vec2 c1 = vec2(-0.42 + sin(t * 0.10) * 0.30, sin(t * 0.08) * 0.18);
  vec2 c2 = vec2(0.48 + cos(t * 0.09) * 0.26, cos(t * 0.07) * 0.20);
  float d1 = length((p - c1) * vec2(0.72, 1.0));
  float d2 = length((p - c2) * vec2(0.72, 1.0));
  float g1 = 1.0 - smoothstep(0.28, 0.70, d1);
  float g2 = 1.0 - smoothstep(0.26, 0.66, d2);
  float gelRim = max(band(d1 - 0.46, 0.035), band(d2 - 0.42, 0.035));
  float gelCore = smoothstep(0.20, 0.66, g1 + g2);
  return vec4(g1, g2, gelRim, gelCore);
}

vec4 magnetField(vec2 p, float t, vec4 q){
  vec2 c = vec2(sin(t*0.12)*0.42, cos(t*0.09)*0.16);
  vec2 d = p-c;
  float r = length(d*vec2(0.62,1.0));
  float ridges = 0.5+0.5*sin(r*(9.0+q.x*3.0)-t*0.38+atan(d.y,d.x)*2.0);
  float mass = 1.0-smoothstep(0.42,1.48,r);
  return vec4(mass,ridges*mass,(1.0-ridges)*mass,band(r-q.z*0.42,0.08));
}

vec4 ringField(vec2 p, float t, vec4 q){
  vec2 left = p-vec2(-0.34+sin(t*0.10)*0.22,0.08);
  vec2 right = p-vec2(0.40-cos(t*0.09)*0.24,-0.10);
  float r1 = length(left*vec2(0.66,1.0));
  float r2 = length(right*vec2(0.66,1.0));
  return vec4(band(r1-q.x*0.34,0.09),band(r2-q.y*0.32,0.09),1.0-smoothstep(0.08,0.54,abs(r1-r2)),fbm(p*2.2+vec2(t*0.08)));
}

vec4 tensionField(vec2 p, float t, vec4 q){
  float seam = p.y-sin(p.x*(1.2+q.x)+t*0.12)*0.22-(fbm(p*1.6+vec2(t*0.04))-0.5)*0.26;
  float gap = smoothstep(0.04,0.20,abs(seam));
  float skin = 1.0-smoothstep(0.18,0.58,abs(seam));
  return vec4(skin*(seam>0.0?1.0:0.0),skin*(seam<0.0?1.0:0.0),1.0-gap,band(seam,0.08));
}

vec4 interferenceField(vec2 p, float t, vec4 q){
  float a = length((p-vec2(-0.46,0.0))*vec2(0.68,1.0));
  float b = length((p-vec2(0.52,0.04))*vec2(0.68,1.0));
  float phase = sin((a-b)*(8.0+q.x*3.0)-t*0.24);
  float tide = sin((a+b)*(3.0+q.z)-t*0.10);
  return vec4(0.5+0.5*phase,0.5-0.5*phase,0.5+0.5*tide,1.0-smoothstep(0.12,0.78,abs(phase-tide)));
}

vec4 forceField(vec2 p, float t, vec4 q){
  float left = 1.0 - smoothstep(0.20, 0.98, length((p - vec2(-0.42 + sin(t * 0.08) * 0.20, 0.0)) * vec2(0.62, 1.0)));
  float right = 1.0 - smoothstep(0.20, 0.98, length((p - vec2(0.46 - cos(t * 0.07) * 0.18, 0.0)) * vec2(0.62, 1.0)));
  float flow = fbm(p * vec2(1.0 + q.x * 0.3, 2.8) + vec2(t * 0.06, -t * 0.04));
  float channelLine = p.y - sin(p.x * (1.1 + q.z) - t * (0.08 + q.w * 0.08)) * 0.22 - (flow - 0.5) * 0.20;
  float forceChannel = band(channelLine, 0.10) * max(left, right);
  float forceShear = band(channelLine + sin(p.x * 2.4 + t * 0.10) * 0.12, 0.045) * (0.45 + 0.55 * flow);
  return vec4(left, right, forceChannel, forceShear);
}

vec4 filamentField(vec2 p, float t, vec4 q){
  float n = fbm(p*vec2(0.84,3.8)+vec2(t*0.16,-t*0.08));
  float f1 = 0.5+0.5*sin((p.y+(n-0.5)*0.54)*(8.0+q.x*4.0)+p.x*1.6-t*0.42);
  float f2 = 0.5+0.5*sin((p.y-(n-0.5)*0.46)*(10.0+q.y*3.0)-p.x*1.2+t*0.34);
  return vec4(f1,f2,smoothstep(0.56,0.94,f1),smoothstep(0.60,0.96,f2));
}

vec4 causticFoldField(vec2 p, float t, vec4 q){
  float haze = fbm(p * vec2(0.74, 2.8) + vec2(t * 0.05, -t * 0.03));
  float center = p.y - sin(p.x * (1.2 + q.x) - t * 0.12) * 0.18 - (haze - 0.5) * 0.22;
  float foldA = softLine(center + sin(p.x * 2.4 + t * 0.08) * 0.09, 0.025, 0.055);
  float foldB = softLine(center - 0.20 - cos(p.x * 1.8 - t * 0.10) * 0.08, 0.035, 0.070);
  float body = softLine(center, 0.20, 0.28);
  float pulse = 0.5 + 0.5 * sin(t * (0.08 + q.w * 0.05));
  return vec4(body, body * (0.45 + haze * 0.55), max(foldA, foldB), pulse * body);
}

vec4 glassCollisionField(vec2 p, float t, vec4 q){
  float approach = 0.54 - (0.5 + 0.5 * sin(t * 0.10)) * 0.34;
  vec2 leftCenter = vec2(-approach, sin(t * 0.07) * 0.10);
  vec2 rightCenter = vec2(approach, -sin(t * 0.08) * 0.10);
  float leftDistance = length((p - leftCenter) * vec2(0.64, 1.0));
  float rightDistance = length((p - rightCenter) * vec2(0.64, 1.0));
  float leftBody = 1.0 - smoothstep(0.28, 0.78, leftDistance);
  float rightBody = 1.0 - smoothstep(0.28, 0.78, rightDistance);
  float rim = max(softLine(leftDistance - 0.52, 0.02, 0.07), softLine(rightDistance - 0.52, 0.02, 0.07));
  float contact = softLine(leftDistance - rightDistance, 0.025, 0.08) * max(leftBody, rightBody);
  return vec4(leftBody, rightBody, rim, contact);
}

vec4 prismMembraneField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.76, 3.4) + vec2(t * 0.06, -t * 0.04));
  float membrane = p.y - sin(p.x * (1.1 + q.x) - t * 0.14) * 0.22 - (n - 0.5) * 0.18;
  float crest = softLine(membrane, 0.025, 0.055);
  float upper = softLine(membrane - 0.16, 0.10, 0.18);
  float lower = softLine(membrane + 0.18, 0.11, 0.20);
  float dispersion = crest * (0.5 + 0.5 * sin(p.x * (3.0 + q.z) - t * 0.20));
  return vec4(upper, lower, crest, dispersion);
}

vec4 opalChannelField(vec2 p, float t, vec4 q){
  float a = fbm(p * (1.2 + q.x * 0.4) + vec2(t * 0.06, -t * 0.04));
  float b = fbm(p.yx * (1.8 + q.y * 0.3) + vec2(-t * 0.05, t * 0.07) + 8.0);
  float boundary = a - b;
  float fissure = softLine(boundary, 0.025, 0.07);
  float channel = softLine(p.y - sin(p.x * (1.4 + q.z) - t * 0.18) * 0.18 - boundary * 0.22, 0.045, 0.10);
  return vec4(smoothstep(0.30, 0.72, a), smoothstep(0.30, 0.72, b), fissure, channel);
}

vec4 veinField(vec2 p, float t, vec4 q){
  float n1 = fbm(p * vec2(0.82, 3.8 + q.x) + vec2(t * 0.12, -t * 0.05));
  float n2 = fbm(p.yx * vec2(2.6, 0.72) + vec2(-t * 0.08, t * 0.04) + 6.0);
  float branchA = softLine(sin((p.y + (n1 - 0.5) * 0.42) * (5.0 + q.z) + p.x * 1.4 - t * 0.22), 0.06, 0.16);
  float branchB = softLine(sin((p.y - (n2 - 0.5) * 0.38) * (6.0 + q.y) - p.x * 1.1 + t * 0.17), 0.06, 0.16);
  float cells = 1.0 - smoothstep(0.08, 0.48, abs(n1 - n2));
  return vec4(n1, n2, max(branchA, branchB), cells * min(branchA + branchB, 1.0));
}

vec4 vortexMergeField(vec2 p, float t, vec4 q){
  float approach = 0.62 - (0.5 + 0.5 * sin(t * 0.08)) * 0.36;
  vec2 left = p - vec2(-approach, 0.10);
  vec2 right = p - vec2(approach, -0.10);
  float leftRadius = length(left * vec2(0.66, 1.0));
  float rightRadius = length(right * vec2(0.66, 1.0));
  float leftSpin = 0.5 + 0.5 * sin(leftRadius * (8.0 + q.x * 2.0) + atan(left.y, left.x) * 2.0 - t * 0.30);
  float rightSpin = 0.5 + 0.5 * sin(rightRadius * (8.0 + q.z * 2.0) - atan(right.y, right.x) * 2.0 - t * 0.26);
  float leftMass = 1.0 - smoothstep(0.34, 0.92, leftRadius);
  float rightMass = 1.0 - smoothstep(0.34, 0.92, rightRadius);
  return vec4(leftMass * leftSpin, rightMass * rightSpin, min(leftMass, rightMass), softLine(leftRadius - rightRadius, 0.03, 0.10));
}

vec4 jetCollisionField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.82, 4.0) + vec2(t * 0.13, -t * 0.06));
  float seam = p.y - sin(p.x * (1.2 + q.x) - t * 0.18) * 0.15 - (n - 0.5) * 0.18;
  float leftJet = softLine(seam - p.x * 0.13, 0.055, 0.13) * (1.0 - smoothstep(-0.18, 0.76, p.x));
  float rightJet = softLine(seam + p.x * 0.13, 0.055, 0.13) * smoothstep(-0.76, 0.18, p.x);
  float impact = softLine(p.x + sin(t * 0.09) * 0.16, 0.05, 0.14) * softLine(seam, 0.10, 0.22);
  float tear = softLine(seam + sin(p.x * 2.4 + t * 0.13) * 0.11, 0.03, 0.08);
  return vec4(leftJet, rightJet, impact, tear);
}

vec4 shockField(vec2 p, float t, vec4 q){
  vec2 center = vec2(sin(t * 0.07) * 0.34, cos(t * 0.06) * 0.10);
  float radius = length((p - center) * vec2(0.62, 1.0));
  float cycle = 0.28 + fract(t * (0.035 + q.w * 0.02)) * 0.78;
  float ring = softLine(radius - cycle, 0.025, 0.08);
  float core = 1.0 - smoothstep(0.16, 0.62, radius);
  float fog = fbm(p * vec2(0.90, 2.8) + vec2(t * 0.05, -t * 0.03));
  float pressure = softLine(radius - cycle * 0.68 - (fog - 0.5) * 0.10, 0.05, 0.12);
  return vec4(core, pressure, ring, ring * (0.45 + fog * 0.55));
}

vec4 collapseField(vec2 p, float t, vec4 q){
  float pulse = 0.5 + 0.5 * sin(t * (0.07 + q.w * 0.04));
  vec2 scale = vec2(mix(0.48, 1.18, pulse), mix(1.28, 0.68, pulse));
  float n = fbm(p * vec2(0.76, 3.0) + vec2(t * 0.06, -t * 0.04));
  float mass = 1.0 - smoothstep(0.28, 1.02, length((p + vec2((n - 0.5) * 0.18, 0.0)) * scale));
  float core = 1.0 - smoothstep(0.10, 0.46, length(p * scale));
  float lateral = softLine(p.y - (n - 0.5) * 0.20, 0.09, 0.20) * pulse;
  return vec4(mass, core, lateral, min(mass, core + lateral));
}

vec4 shearBraidField(vec2 p, float t, vec4 q){
  float n = fbm(p * vec2(0.72, 4.4) + vec2(t * 0.14, -t * 0.07));
  float upper = p.y - 0.18 - sin(p.x * (1.5 + q.x) - t * 0.22) * 0.16 - (n - 0.5) * 0.16;
  float lower = p.y + 0.18 - sin(p.x * (1.9 + q.z) + t * 0.17) * 0.15 + (n - 0.5) * 0.14;
  float filament = sin((p.y + (n - 0.5) * 0.44) * (8.0 + q.x * 2.0) + p.x * 1.4 - t * 0.34);
  return vec4(softLine(upper, 0.10, 0.19), softLine(lower, 0.10, 0.19), softLine(upper - lower, 0.035, 0.09), softLine(filament, 0.05, 0.14));
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
  bool legacy = kernel == 0;
  bool collisionFamily = legacy && (variant < 2 || variant == 6);
  bool weaveFamily = legacy && variant >= 2 && variant < 4;
  bool vortexFamily = legacy && variant >= 4 && variant < 6;
  bool diffusionVariant = legacy && variant == 7;
  bool fusionVariant = legacy && variant == 8;
  bool breathVariant = legacy && variant == 9;
  bool fastVariant = legacy && variant == 10;
  bool slowVariant = legacy && variant == 11;
  float fogA = fbm(p * 2.0 + flowDrift);
  float fogB = fbm(p * 3.2 + vec2(-flowDrift.y, flowDrift.x) * 0.82 + vec2(7.3));
  float fogC = 0.5;
  if(weaveFamily || fusionVariant || fastVariant){
    fogC = fbm(p * 4.1 + vec2(-flowDrift.x * 0.68, flowDrift.y * 0.92) + vec2(13.7, 4.9));
  }
  vec2 warped = p + vec2(fogA - 0.5, fogB - 0.5) * 0.34;
  vec4 materialFields = vec4(0.0);
  if(kernel == 1) materialFields = veilField(p, flowTime, studyParams);
  if(kernel == 2) materialFields = filmField(p, flowTime, studyParams);
  if(kernel == 3) materialFields = lensField(p, flowTime, studyParams);
  if(kernel == 4) materialFields = glowField(p, flowTime, studyParams);
  if(kernel == 5) materialFields = waveField(p, flowTime, studyParams);
  if(kernel == 6) materialFields = gelField(p, flowTime, studyParams);
  if(kernel == 7) materialFields = magnetField(p, flowTime, studyParams);
  if(kernel == 8) materialFields = ringField(p, flowTime, studyParams);
  if(kernel == 9) materialFields = tensionField(p, flowTime, studyParams);
  if(kernel == 10) materialFields = interferenceField(p, flowTime, studyParams);
  if(kernel == 11) materialFields = forceField(p, flowTime, studyParams);
  if(kernel == 12) materialFields = filamentField(p, flowTime, studyParams);
  if(kernel == 13) materialFields = seamField(p, flowTime, studyParams);
  if(kernel == 14) materialFields = braidField(p, flowTime, studyParams);
  if(kernel == 15) materialFields = wakeField(p, flowTime, studyParams);
  if(kernel == 16) materialFields = foldField(p, flowTime, studyParams);
  if(kernel == 17) materialFields = causticFoldField(p, flowTime, studyParams);
  if(kernel == 18) materialFields = glassCollisionField(p, flowTime, studyParams);
  if(kernel == 19) materialFields = prismMembraneField(p, flowTime, studyParams);
  if(kernel == 20) materialFields = opalChannelField(p, flowTime, studyParams);
  if(kernel == 21) materialFields = veinField(p, flowTime, studyParams);
  if(kernel == 22) materialFields = vortexMergeField(p, flowTime, studyParams);
  if(kernel == 23) materialFields = jetCollisionField(p, flowTime, studyParams);
  if(kernel == 24) materialFields = shockField(p, flowTime, studyParams);
  if(kernel == 25) materialFields = collapseField(p, flowTime, studyParams);
  if(kernel == 26) materialFields = shearBraidField(p, flowTime, studyParams);

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
  float breathPulse = 1.0;

  if(kernel == 0 && variant == 1){
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
  if(kernel == 0 && variant == 2){
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
  if(kernel == 0 && variant == 3){
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
  if(kernel == 0 && variant == 4){
    shape = mat2(0.94, -0.34, 0.34, 0.94) * warped;
    centerA = vec2(-0.20, 0.34) + macroDrift * 0.10;
    centerB = vec2(0.12, 0.08) - macroDrift.yx * 0.11;
    centerC = vec2(0.48, -0.16) + macroDrift * 0.12;
    centerD = vec2(0.84, -0.38) - macroDrift.yx * 0.10;
    scaleA = scaleB = scaleC = scaleD = vec2(0.58, 1.10);
    outer = vec4(0.66, 0.62, 0.70, 0.66);
  }
  if(kernel == 0 && variant == 5){
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
  if(kernel == 0 && variant == 6){
    float impactCycle = 0.5 + 0.5 * sin(flowTime * 0.22 + phase);
    float approach = mix(0.62, 0.10, impactCycle);
    shape = warped;
    shape.x += (fogA - fogB) * 0.54;
    shape.y += sin(warped.x * 5.4 - flowTime * 0.34 + phase) * 0.11;
    centerA = vec2(-approach, 0.14);
    centerB = vec2(approach, -0.14);
    centerC = vec2(-approach * 0.72, -0.28);
    centerD = vec2(approach * 0.72, 0.28);
    scaleA = scaleB = scaleC = scaleD = vec2(0.46, 0.84);
    outer = vec4(0.74, 0.74, 0.66, 0.66);
  }
  if(kernel == 0 && variant == 7){
    float diffusionWave = 0.5 + 0.5 * sin(flowTime * 0.09 + phase);
    float diffusionScale = mix(1.16, 0.72, diffusionWave);
    shape = warped * diffusionScale;
    shape += normalize(warped + vec2(0.001)) * (fogA - 0.5) * 0.24;
    centerA = vec2(0.10, 0.04);
    centerB = vec2(0.30, -0.08);
    centerC = vec2(0.50, 0.16);
    centerD = vec2(0.66, -0.20);
    scaleA = vec2(0.58, 0.72);
    scaleB = vec2(0.64, 0.78);
    scaleC = vec2(0.72, 0.84);
    scaleD = vec2(0.80, 0.92);
    outer = mix(vec4(0.54, 0.50, 0.46, 0.42), vec4(0.92, 0.84, 0.76, 0.68), diffusionWave);
  }
  if(kernel == 0 && variant == 8){
    float fusionShift = sin(flowTime * 0.13 + phase) * 0.16;
    shape = warped + vec2(fogC - fogB, fogA - fogC) * 0.46;
    centerA = vec2(-0.04 + fusionShift, 0.12);
    centerB = vec2(0.20 - fusionShift, -0.10);
    centerC = vec2(0.42 + fusionShift * 0.60, 0.16);
    centerD = vec2(0.62 - fusionShift * 0.60, -0.14);
    scaleA = scaleB = scaleC = scaleD = vec2(0.58, 0.82);
    outer = vec4(0.84, 0.84, 0.78, 0.76);
  }
  if(kernel == 0 && variant == 9){
    breathPulse = 0.5 + 0.5 * sin(flowTime * 0.085 + phase);
    float breathScale = mix(0.82, 1.14, breathPulse);
    shape = warped * breathScale;
    centerA = vec2(-0.02, 0.12);
    centerB = vec2(0.26, -0.14);
    centerC = vec2(0.52, 0.18);
    centerD = vec2(0.78, -0.18);
    scaleA = scaleB = scaleC = scaleD = vec2(0.54, 0.82);
    outer = mix(vec4(0.86, 0.82, 0.78, 0.72), vec4(0.62, 0.60, 0.56, 0.52), breathPulse);
  }
  if(kernel == 0 && variant == 10){
    float fastPhase = flowTime * 0.72 + phase;
    shape = vec2(
      warped.x + sin(warped.y * 8.0 - fastPhase) * 0.22 + (fogC - 0.5) * 0.28,
      warped.y + sin(warped.x * 3.0 - fastPhase * 0.60) * 0.05
    );
    centerA = vec2(-0.12, 0.34);
    centerB = vec2(0.18, 0.10);
    centerC = vec2(0.50, -0.12);
    centerD = vec2(0.84, -0.34);
    scaleA = scaleB = scaleC = scaleD = vec2(0.34, 1.72);
    outer = vec4(0.62, 0.60, 0.58, 0.56);
  }
  if(kernel == 0 && variant == 11){
    float slowLift = sin(flowTime * 0.035 + phase) * 0.06;
    shape = warped + vec2((fogA - 0.5) * 0.18, (fogB - 0.5) * 0.12);
    centerA = vec2(-0.08, 0.18 + slowLift);
    centerB = vec2(0.28, -0.12 + slowLift * 0.50);
    centerC = vec2(0.58, 0.22 - slowLift * 0.40);
    centerD = vec2(0.86, -0.18 - slowLift * 0.60);
    scaleA = scaleB = scaleC = scaleD = vec2(0.36, 0.68);
    outer = vec4(0.94, 0.90, 0.86, 0.82);
  }

  if(collisionFamily){
    float impact = fogA - fogB;
    float collisionForce = variant == 6 ? 0.62 : (variant == 0 ? 0.42 : 0.30);
    shape += vec2(impact * collisionForce, (fogA + fogB - 1.0) * 0.18);
  }
  if(weaveFamily){
    vec2 braid = vec2(fogC - fogB, fogA - fogC);
    shape += braid * (variant == 2 ? 0.34 : 0.43);
  }
  if(vortexFamily){
    vec2 primaryCenter = variant == 4 ? vec2(0.20, 0.02) : vec2(0.44, 0.08);
    vec2 vortexFlow = vortexWarp(shape, primaryCenter, 0.82 + fogA * 0.34, 0.72);
    if(kernel == 0 && variant == 5){
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
  float detailC = (weaveFamily || fusionVariant || fastVariant) ? fogC : fogB;
  float layerAlphaA = smoothstep(0.02, 0.82, cloudA) * leftFade * (0.74 + fogA * 0.26);
  float layerAlphaB = smoothstep(0.02, 0.82, cloudB) * leftFade * (0.72 + fogB * 0.28);
  float layerAlphaC = smoothstep(0.02, 0.82, cloudC) * leftFade * (0.76 + detailC * 0.24);
  float layerAlphaD = smoothstep(0.02, 0.82, cloudD) * leftFade * (0.74 + mix(fogA, detailC, 0.5) * 0.26);
  if(kernel > 0){
    float materialFade = smoothstep(0.0, 0.22, uv.x);
    vec4 tunedFields = pow(clamp(materialFields, 0.0, 1.0), vec4(0.82));
    layerAlphaA = tunedFields.x * materialFade;
    layerAlphaB = tunedFields.y * materialFade;
    layerAlphaC = tunedFields.z * materialFade;
    layerAlphaD = tunedFields.w * materialFade;
  }
  float breathGain = breathVariant ? mix(0.70, 1.0, breathPulse) : 1.0;
  layerAlphaA *= breathGain;
  layerAlphaB *= breathGain;
  layerAlphaC *= breathGain;
  layerAlphaD *= breathGain;
  float smokeDensity = max(max(layerAlphaA, layerAlphaB), max(layerAlphaC, layerAlphaD));
  float strength = (collisionFamily ? 0.60 : 0.48) + intensity * 0.30;

  vec3 color = vec3(0.985);
  color = mix(color, colorA, layerAlphaA * strength);
  color = mix(color, colorB, layerAlphaB * strength);
  color = mix(color, mix(colorA, colorB, 0.30), layerAlphaC * strength * 0.88);
  color = mix(color, mix(colorA, colorB, 0.72), layerAlphaD * strength * 0.84);

  bool opticalKernel = (kernel >= 2 && kernel <= 6) || (kernel >= 17 && kernel <= 21);
  if(opticalKernel){
    float opticalEdge = smoothstep(0.42, 0.94, materialFields.z);
    vec3 spectral = mix(colorA, colorB, 0.5 + 0.5 * sin((p.x + p.y) * 1.8 + flowTime * 0.12));
    color = mix(color, spectral, opticalEdge * 0.22);
    color = mix(color, vec3(1.0), materialFields.w * opticalEdge * 0.16);
  }
  bool forceKernel = (kernel >= 7 && kernel <= 12) || kernel >= 22;
  if(forceKernel){
    float forceOverlap = min(materialFields.x, materialFields.y);
    vec3 denseInk = clamp(mix(colorA, colorB, materialFields.y) * 0.82, 0.0, 1.0);
    color = mix(color, denseInk, forceOverlap * (0.16 + intensity * 0.16));
  }

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
  if(diffusionVariant){
    color = mix(color, mix(colorA, colorB, 0.34), smokeDensity * 0.08);
  }
  if(fusionVariant){
    color = mix(color, mixedInk, fusionMask * (0.38 + intensity * 0.22));
    color = mix(color, mix(colorA, colorB, fogC), pairwiseWeave * 0.16);
  }
  if(breathVariant){
    color = mix(color, mixedInk, fusionMask * 0.12 * breathGain);
  }
  if(fastVariant){
    float rushFilament = smoothstep(0.10, 0.58, abs(fogC - fogB)) * smokeDensity;
    color = mix(color, mix(colorA, colorB, fogC), rushFilament * 0.22);
  }
  if(slowVariant){
    color = mix(color, mixedInk, smokeDensity * 0.08);
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
  return MOTION_STUDIES.map((motionStudy) => {
    const cardSeed = (seed + Math.imul(motionStudy.id + 1, 0x9e3779b1)) >>> 0;
    const preset = createPreset(cardSeed);
    return {
      ...preset,
      speed: motionStudy.speed ?? preset.speed,
      seed: cardSeed,
      studyId: motionStudy.id,
      variant: motionStudy.shaderVariant,
      kernel: motionStudy.kernel,
      params: motionStudy.params,
    };
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
  const kernelValue = Math.trunc(clamp(config.kernel, 0, 26));
  const params = config.params.map((value) => clamp(value, -2, 2));
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
    const resolution=gl.getUniformLocation(program,"resolution"),time=gl.getUniformLocation(program,"time"),seed=gl.getUniformLocation(program,"seed"),intensity=gl.getUniformLocation(program,"intensity"),variant=gl.getUniformLocation(program,"variant"),kernel=gl.getUniformLocation(program,"kernel"),studyParams=gl.getUniformLocation(program,"studyParams"),a=gl.getUniformLocation(program,"colorA"),b=gl.getUniformLocation(program,"colorB");
    const resize=()=>{const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));gl.viewport(0,0,canvas.width,canvas.height)};
    new ResizeObserver(resize).observe(canvas);resize();
    const draw=(now=0)=>{gl.uniform2f(resolution,canvas.width,canvas.height);gl.uniform1f(time,now*.001*${speed}*${SMOKE_TIME_SCALE});gl.uniform1f(seed,${seed}.0);gl.uniform1f(intensity,${intensity});gl.uniform1i(variant,${variantValue});gl.uniform1i(kernel,${kernelValue});gl.uniform4f(studyParams,${params[0]},${params[1]},${params[2]},${params[3]});gl.uniform3f(a,${aR},${aG},${aB});gl.uniform3f(b,${bR},${bG},${bB});gl.drawArrays(gl.TRIANGLE_STRIP,0,4)};
    let frame=0;const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loop=(now)=>{if(!root.isConnected)return;draw(now);frame=requestAnimationFrame(loop)};
    const start=()=>{if(!frame&&!document.hidden&&!reduced)frame=requestAnimationFrame(loop)};
    const stop=()=>{cancelAnimationFrame(frame);frame=0};
    document.addEventListener("visibilitychange",()=>document.hidden?stop():start());
    draw();start();
  }catch(error){console.warn("Luma card WebGL fallback",error)}
})();</script>`;
}
