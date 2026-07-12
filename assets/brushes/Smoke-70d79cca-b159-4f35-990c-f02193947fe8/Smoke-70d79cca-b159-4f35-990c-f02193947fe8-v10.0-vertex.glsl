// Copyright 2020 The Tilt Brush Authors
// Updated to OpenGL ES 3.0 by the Icosa Gallery Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Smoke particle brush — camera-facing quads + Unity curl-noise drift.
// (GLTF preview shaders historically omitted the curl animation.)

in vec4 a_position;
in vec3 a_normal;
in vec4 a_color;
in vec4 a_texcoord0;
in vec4 a_texcoord1;

out vec4 v_color;
out vec3 v_normal;  // Camera-space normal.
out vec3 v_position;  // Camera-space position.
out vec2 v_texcoord0;
out vec3 v_light_dir_0;  // Camera-space light direction, main light.
out vec3 v_light_dir_1;  // Camera-space light direction, other light.

uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

uniform mat4 u_SceneLight_0_matrix;
uniform mat4 u_SceneLight_1_matrix;
uniform vec4 u_time;
uniform float u_ScrollRate;

const float kRecipSquareRootOfTwo = 0.70710678;

// Given a centerpoint, up and right vectors, the particle rotation and vertex index,
// This will create the appropriate position of a quad that faces the camera.
vec3 recreateCorner(vec3 center, float corner, float rotation, float size) {
  float c = cos(rotation);
  float s = sin(rotation);

  // Basis in camera space, which is well known.
  vec3 up = vec3(s, c, 0);
  vec3 right = vec3(c, -s, 0);

  // Corner diagram:
  //
  //   2 . . . 3
  //   .   |   .
  //   . - c - < --- center
  //   .   |   .
  //   0 . . . 1
  //
  // The top corners are corners 2 & 3
  float fUp = float(corner == 0. || corner == 1.) * 2.0 - 1.0;

  // The corners to the right are corners 1 & 3
  float fRight = float(corner == 0. || corner == 2.) * 2.0 - 1.0;

  center = (modelViewMatrix * vec4(center, 1.0)).xyz;
  center += fRight * right * size;
  center += fUp * up * size;
  return (inverse(modelViewMatrix) * vec4(center, 1.0)).xyz;
}

// Adjusts the vertex of a quad to make a camera-facing quad. Also optionally scales the particle if
// the particle is in the preview brush.
vec4 PositionParticle(
	float vertexId,
	vec4 vertexPos,
	vec3 center,
	float rotation) {

	float corner = mod(vertexId, 4.0);
	float size = length(vertexPos.xyz - center) * kRecipSquareRootOfTwo;

	// Gets the scale from the model matrix
	float scale = modelMatrix[1][1];
	vec3 newCorner = recreateCorner(center, corner, rotation, size * scale);

	return vec4(newCorner.x, newCorner.y, newCorner.z, 1);
}

// Returns the particle position for this vertex, untransformed, in local/object space.
vec4 GetParticlePositionLS() {
	return PositionParticle(float(gl_VertexID), a_position, a_normal, a_texcoord0.z);
}

// -------------------------------------------------------------------------
// Curl noise (Unity Noise.cginc / Bubbles web port)
// -------------------------------------------------------------------------

vec3 mod289_v3(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289_v2(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute_v3(vec3 x) {
  return mod289_v3(((x * 34.0) + 1.0) * x);
}

float snoise2D(vec2 v) {
  const vec4 C = vec4(0.211324865405187,
                      0.366025403784439,
                     -0.577350269189626,
                      0.024390243902439);

  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);

  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod289_v2(i);
  vec3 p = permute_v3(permute_v3(i.y + vec3(0.0, i1.y, 1.0))
                                + i.x + vec3(0.0, i1.x, 1.0));

  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec3 snoise3D(vec3 v) {
  return vec3(
    snoise2D(vec2(v.x, v.y)),
    snoise2D(vec2(v.y, v.z)),
    snoise2D(vec2(v.z, v.x))
  );
}

float curlX(vec3 v, float d) {
  return (
    (snoise3D(vec3(v.x, v.y + d, v.z)).z - snoise3D(vec3(v.x, v.y - d, v.z)).z)
   -(snoise3D(vec3(v.x, v.y, v.z + d)).y - snoise3D(vec3(v.x, v.y, v.z - d)).y)
  ) / 2.0 / d;
}

float curlY(vec3 v, float d) {
  return (
    (snoise3D(vec3(v.x, v.y, v.z + d)).x - snoise3D(vec3(v.x, v.y, v.z - d)).x)
   -(snoise3D(vec3(v.x + d, v.y, v.z)).z - snoise3D(vec3(v.x - d, v.y, v.z)).z)
  ) / 2.0 / d;
}

float curlZ(vec3 v, float d) {
  return (
    (snoise3D(vec3(v.x + d, v.y, v.z)).y - snoise3D(vec3(v.x - d, v.y, v.z)).y)
   -(snoise3D(vec3(v.x, v.y + d, v.z)).x - snoise3D(vec3(v.x, v.y - d, v.z)).x)
  ) / 2.0 / d;
}

// Unity Smoke.shader (toolkit / meter world):
//   time = _Time.x * 5; disp = curl(center * 0.1 + time) * 5 * 0.1
vec3 smokeCurlDisplacement(vec3 worldCenter) {
  float time = u_time.x * 5.0;
  float d = 30.0;
  float freq = 0.1;
  vec3 p = worldCenter * freq + time;
  vec3 disp = vec3(curlX(p, d), curlY(p, d), curlZ(p, d));
  return disp * 5.0 * 0.1;
}

void main() {
  vec4 pos = GetParticlePositionLS();

  // Curl-noise drift on particle centers (matches Unity Smoke.shader).
  vec3 worldCenter = (modelMatrix * vec4(a_normal, 1.0)).xyz;
  vec3 worldPos = (modelMatrix * pos).xyz + smokeCurlDisplacement(worldCenter);
  pos = inverse(modelMatrix) * vec4(worldPos, 1.0);

  gl_Position = projectionMatrix * modelViewMatrix * pos;
  v_normal = normalize(normalMatrix * a_normal);
  v_position = (modelViewMatrix * pos).xyz;
  v_light_dir_0 = u_SceneLight_0_matrix[2].xyz;
  v_light_dir_1 = u_SceneLight_1_matrix[2].xyz;
  v_color = a_color;
  v_texcoord0 = a_texcoord0.xy;
}
