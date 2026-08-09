import { FRAGMENT_SHADER, VERTEX_SHADER } from "../card-core.ts";

export const LAB_VERTEX_SHADER = VERTEX_SHADER;

const functionsStart = FRAGMENT_SHADER.indexOf("float hash");
const mainStart = FRAGMENT_SHADER.indexOf("\nvoid main(){", functionsStart);
const bodyStart = FRAGMENT_SHADER.indexOf("  vec2 p =", mainStart);
const outputStart = FRAGMENT_SHADER.indexOf(
  "  outColor = vec4(color, 1.0);",
  bodyStart,
);

if (
  [functionsStart, mainStart, bodyStart, outputStart].some(
    (index) => index < 0,
  )
) {
  throw new Error("The atlas shader no longer exposes the expected study body");
}

// ponytail: reuse the validated 144-study body; split shared GLSL only if a third renderer appears.
const studyFunctions = FRAGMENT_SHADER.slice(functionsStart, mainStart);
const studyBody = FRAGMENT_SHADER.slice(bodyStart, outputStart);

export const LAB_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform vec2 viewportOrigin;
uniform float globalTime;
uniform float interactionStrength;
uniform int layerCount;
uniform float layerTimes[6];
uniform float layerSeeds[6];
uniform float layerIntensities[6];
uniform int layerVariants[6];
uniform int layerKernels[6];
uniform vec4 layerParams[6];
uniform vec3 layerColorsA[6];
uniform vec3 layerColorsB[6];
uniform vec4 layerTransforms[6];
uniform int interactionModes[6];
out vec4 outColor;

float time;
float seed;
float intensity;
int variant;
int kernel;
vec4 studyParams;
vec3 colorA;
vec3 colorB;

${studyFunctions}

vec3 renderStudy(vec2 uv){
${studyBody}
  return color;
}

vec3 interactLayers(
  vec3 accumulated,
  vec3 incoming,
  float accumulatedDensity,
  float incomingDensity,
  int mode,
  float mask
){
  if(mode == 0) return mix(accumulated, incoming, mask);
  if(mode == 1){
    float seam = smoothstep(0.08, 0.42, min(accumulatedDensity, incomingDensity));
    vec3 impact = min(accumulated, incoming) * 0.84;
    return mix(
      mix(accumulated, incoming, mask),
      impact,
      seam * 0.34 * interactionStrength
    );
  }
  if(mode == 2) return mix(accumulated, incoming, smoothstep(0.34, 0.66, mask));
  if(mode == 3){
    vec3 eroded = accumulated * (1.0 - incomingDensity * 0.18);
    return mix(eroded, incoming, mask);
  }
  if(mode == 4) return 1.0 - (1.0 - accumulated) * (1.0 - incoming * mask);
  if(mode == 5) return mix(accumulated, abs(accumulated - incoming), mask * 0.72);
  return mix(accumulated, incoming, mask);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - viewportOrigin) / resolution.xy;
  vec3 color = vec3(0.985);
  float accumulatedDensity = 0.0;
  vec2 interactionWarp = vec2(0.0);

  for(int i = 0; i < 6; i++){
    if(i >= layerCount) break;
    time = layerTimes[i];
    seed = layerSeeds[i];
    intensity = layerIntensities[i];
    variant = layerVariants[i];
    kernel = layerKernels[i];
    studyParams = layerParams[i];
    colorA = layerColorsA[i];
    colorB = layerColorsB[i];

    vec4 transform = layerTransforms[i];
    float turn = transform.y;
    float cosine = cos(turn);
    float sine = sin(turn);
    mat2 rotation = mat2(cosine, -sine, sine, cosine);
    vec2 localUv = rotation * (uv - 0.5) / max(transform.x, 0.25) + 0.5;
    vec2 sampleUv = localUv + interactionWarp;
    vec3 incoming = renderStudy(sampleUv);
    float incomingDensity = clamp(length(incoming - vec3(0.985)) * 1.32, 0.0, 1.0);
    float weaveNoise = noise(
      sampleUv * (2.6 + float(i) * 0.37) +
      vec2(globalTime * 0.021, -globalTime * 0.016)
    );
    float layerMask = clamp(
      incomingDensity * (0.56 + transform.z * 1.35) + weaveNoise * 0.22,
      0.0,
      1.0
    );

    float tunedLayerMask = clamp(layerMask * interactionStrength, 0.0, 1.0);

    if(i == 0){
      color = mix(vec3(0.985), incoming, 0.82 + transform.z * 0.18);
      accumulatedDensity = incomingDensity;
    } else {
      color = interactLayers(
        color,
        incoming,
        accumulatedDensity,
        incomingDensity,
        interactionModes[i],
        tunedLayerMask
      );
      accumulatedDensity = clamp(
        accumulatedDensity + incomingDensity * transform.z,
        0.0,
        1.0
      );
    }

    float signal = dot(incoming, vec3(0.299, 0.587, 0.114));
    interactionWarp += vec2(signal - 0.5, weaveNoise - 0.5) *
      transform.w * interactionStrength * (0.34 + incomingDensity * 0.66);
  }

  color = clamp(color * 1.08, 0.0, 1.35);
  color = color / (vec3(0.82) + color * 0.28);
  color = clamp(color, 0.0, 1.0);
  float colorGate = smoothstep(0.0, 0.18, uv.x);
  outColor = vec4(mix(vec3(0.985), color, colorGate), 1.0);
}`;
