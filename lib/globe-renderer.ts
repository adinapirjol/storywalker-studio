import type { BasemapData } from "./journey-basemap";
import { GLOBE_RADIUS, globeRotation, type GlobeCamera } from "./journey-globe";

/** Texture is made exclusively from the bundled public Natural Earth data. */
export function createGlobeRenderer(canvas: HTMLCanvasElement, data: BasemapData) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
  if (!gl) throw new Error("WebGL unavailable");
  const shaders: WebGLShader[] = [], buffers: WebGLBuffer[] = [];
  let program: WebGLProgram | null = null, texture: WebGLTexture | null = null;
  function dispose() {
    buffers.forEach(buffer => gl!.deleteBuffer(buffer)); shaders.forEach(shader => gl!.deleteShader(shader));
    if (program) gl!.deleteProgram(program); if (texture) gl!.deleteTexture(texture);
  }
  try {
    const shader = (type: number, source: string) => {
      const value = gl.createShader(type)!; shaders.push(value); gl.shaderSource(value, source); gl.compileShader(value);
      if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error("Globe shader unavailable"); return value;
    };
    program = gl.createProgram()!;
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `attribute vec3 point; attribute vec2 uv; uniform mat3 rotation; uniform vec2 scale; varying vec2 tex; varying vec3 normal;
      void main(){ vec3 p=rotation*point; gl_Position=vec4(p.x*scale.x,p.y*scale.y,-p.z*.5,1.); tex=uv; normal=p; }`));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `precision mediump float; uniform sampler2D atlas; varying vec2 tex; varying vec3 normal;
      void main(){vec3 n=normalize(normal); float light=.62+.38*max(0.,dot(n,normalize(vec3(-.3,.5,1.)))); gl_FragColor=vec4(texture2D(atlas,tex).rgb*light,1.);}`));
    gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Globe shader unavailable");
    gl.useProgram(program);
    const vertices: number[] = [], indices: number[] = [], columns = 160, rows = 80;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
      const lon = i / columns * Math.PI * 2 - Math.PI, lat = Math.PI / 2 - j / rows * Math.PI;
      vertices.push(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon), i / columns, j / rows);
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i, b = a + columns + 1; indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const vertexBuffer = gl.createBuffer()!; buffers.push(vertexBuffer); gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    for (const [name, size, offset] of [["point", 3, 0], ["uv", 2, 12]] as const) {
      const location = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 20, offset);
    }
    const indexBuffer = gl.createBuffer()!; buffers.push(indexBuffer); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    const atlas = document.createElement("canvas"); atlas.width = 4096; atlas.height = 2048;
    const ctx = atlas.getContext("2d")!;
    ctx.fillStyle = "#102d40"; ctx.fillRect(0, 0, atlas.width, atlas.height);
    ctx.fillStyle = "#537461"; ctx.strokeStyle = "#a3baa3"; ctx.lineWidth = 1.2;
    for (const country of data.countries) for (const polygon of country.polygons) {
      ctx.beginPath();
      for (const ring of polygon) { ring.forEach((p, i) => { const x = (p[0] + 180) / 360 * atlas.width, y = (90 - p[1]) / 180 * atlas.height; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); }
      ctx.fill("evenodd"); ctx.stroke();
    }
    ctx.strokeStyle = "#a6c0c025"; ctx.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 30) { const x = (lon + 180) / 360 * atlas.width; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, atlas.height); ctx.stroke(); }
    for (let lat = -60; lat <= 60; lat += 30) { const y = (90 - lat) / 180 * atlas.height; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(atlas.width, y); ctx.stroke(); }
    texture = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const rotation = gl.getUniformLocation(program, "rotation"), scale = gl.getUniformLocation(program, "scale");
    gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
    return { dispose, draw(camera: GlobeCamera) {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix3fv(rotation, false, new Float32Array(globeRotation(camera)));
      gl.uniform2f(scale, GLOBE_RADIUS * camera.zoom / 400, GLOBE_RADIUS * camera.zoom / 300);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    } };
  } catch (error) { dispose(); throw error; }
}
