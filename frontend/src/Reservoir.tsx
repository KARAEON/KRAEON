import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

type ReservoirProps = {
  level: number;
  protectedLevel?: number;
  paused: boolean;
  reset: number;
  showDetails: boolean;
  showOverview: boolean;
  onToggleDetails: () => void;
};
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
const noise = (x: number, z: number) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };

function makeTerrain() {
  const points: number[] = [], colors: number[] = [];
  const triangle = (a: number[], b: number[], c: number[], shade: number) => {
    points.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colors.push(shade, shade, shade + .018);
  };
  // A continuous polygon shoreline and beveled outer rings avoid stair-step edges.
  const outline = [[-2.65,6.3],[-2.4,4.5],[-1.9,1.2],[-4.9,0],[-5.35,-2],[-4.9,-4.7],[-2.8,-6],[0,-6.4],[3,-5.9],[5,-4],[5.2,-1.4],[4.9,0],[1.9,1.2],[2.4,4.5],[2.65,6.3]];
  const shore: number[][] = [];
  outline.forEach((p,i) => {
    const q=outline[(i+1)%outline.length];
    for (let j=0;j<3;j++) shore.push([THREE.MathUtils.lerp(p[0],q[0],j/3),THREE.MathUtils.lerp(p[1],q[1],j/3)]);
  });
  const rings = [0,.38,.72,1,1.02].map((t,r) => shore.map(([x,z],i) => {
    const angle=Math.atan2(z,x), ox=Math.cos(angle)*7.5, oz=Math.sin(angle)*7.1;
    const bank=z<.2 ? 2.97 : THREE.MathUtils.lerp(2.9,.05,clamp(z/1.2,0,1));
    const mouth=z>=6.29 && Math.abs(x)<=2.66;
    const edge=mouth ? -.28 : z<0 ? 3.1+noise(i,4)*.9 : .9+noise(i,4)*.6;
    const ridge=z<0 ? 1.05 : .7;
    const y=r===4 ? -1.35 : mouth ? -.28 : THREE.MathUtils.lerp(bank,edge,Math.min(t,1))+Math.sin(t*Math.PI)*ridge*(.4+noise(i,r));
    return r===4 ? [ox*.9,y,oz*.9] : [THREE.MathUtils.lerp(x,ox,t),y,THREE.MathUtils.lerp(z,oz,t)];
  }));
  for(let r=0;r<rings.length-1;r++) for(let i=0;i<shore.length;i++) {
    const j=(i+1)%shore.length, a=rings[r][i],b=rings[r][j],c=rings[r+1][i],d=rings[r+1][j];
    const shade=(r===3?.46:.63)+noise(i,r)*.16;
    triangle(a,b,c,shade); triangle(c,b,d,shade+.035);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals(); return g;
}

const waterVertex = `
varying vec2 vUv;
uniform float uTime;
uniform float uFalls;
void main() {
  vUv = uFalls > .5 ? uv : uv / vec2(10.0, 6.0);
  vec3 p = position;
  if (uFalls < .5) p.z += sin(p.x * 5.0 + uTime * 1.3) * cos(p.y * 4.0 - uTime) * .022;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const waterFragment = `
varying vec2 vUv;
uniform float uTime;
uniform float uFalls;
uniform float uOpacity;
void main() {
  vec2 p = vUv * vec2(12.0, 10.0);
  float facet = sin(floor(p.x) * 3.7 + floor(p.y) * 2.3 + step(fract(p.x), fract(p.y)) * 1.7) * .5 + .5;
  float ripple = sin(p.x * 1.5 + sin(p.y * .8 + uTime) + uTime * 1.5);
  vec3 col = mix(vec3(.001,.38,.44), vec3(.008,.72,.78), facet * .7 + ripple * .10 + .15);
  float line = pow(max(0.0, sin(p.x * 2.8 + sin(p.y + uTime) * .7) * sin(p.y * 2.1 - uTime * 1.8)), 18.0);
  if (uFalls > .5) {
    float streak = pow(max(0.0, sin(vUv.x * 75.0 + sin(vUv.y * 12.0 + uTime * 5.0))), 10.0);
    float pulse = .45 + .55 * pow(max(0.0, sin(vUv.y * 42.0 + uTime * 9.0 + vUv.x * 18.0)), 3.0);
    col = mix(col, vec3(.83,1.0,1.0), streak * pulse * .8);
  } else col = mix(col, vec3(.78,1.0,1.0), line * .65);
  gl_FragColor = vec4(col, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function Water({ geometry, position, rotation, falls = false, opacity, time }: {
  geometry: THREE.BufferGeometry; position: [number, number, number]; rotation?: [number, number, number];
  falls?: boolean; opacity: number; time: { current: number };
}) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: waterVertex, fragmentShader: waterFragment, transparent: true, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uFalls: { value: falls ? 1 : 0 }, uOpacity: { value: 1 } },
  }), [falls]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => { material.uniforms.uTime.value = time.current; material.uniforms.uOpacity.value = opacity; });
  return <mesh geometry={geometry} material={material} position={position} rotation={rotation} dispose={null} />;
}

function Box({ position, size, color = "#e4e3e1", onClick }: { position: [number, number, number]; size: [number, number, number]; color?: string; onClick?: (event: ThreeEvent<MouseEvent>) => void }) {
  return <mesh position={position} castShadow receiveShadow onClick={onClick}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.9} /></mesh>;
}

function Tree({ x, y, z, scale = 1 }: { x: number; y: number; z: number; scale?: number }) {
  return <group position={[x,y,z]} scale={scale}>
    <mesh position={[0,.23,0]} castShadow><cylinderGeometry args={[.09,.11,.46,5]} /><meshStandardMaterial color="#544536" /></mesh>
    <mesh position={[0,.85,0]} castShadow><coneGeometry args={[.42,1.32,5]} /><meshStandardMaterial color="#78937c" flatShading roughness={1} /></mesh>
  </group>;
}

function Foam({ time, strength }: { time: { current: number }; strength: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!ref.current) return;
    for (let i = 0; i < 72; i++) {
      const phase = (time.current * .55 + noise(i,4)) % 1;
      dummy.position.set((i%3-1)*1.35+(noise(i,8)-.5)*1.1, .12+Math.sin(phase*Math.PI)*.28, 1.48+phase*1.5);
      dummy.scale.setScalar((.08+noise(i,12)*.15)*strength*(1-phase*.55));
      dummy.rotation.set(i,phase*3,i*.4); dummy.updateMatrix();
      ref.current.setMatrixAt(i,dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined,undefined,72]} frustumCulled={false}><icosahedronGeometry args={[1,0]} /><meshStandardMaterial color="#e2ffff" roughness={.45} /></instancedMesh>;
}

function Scene({ level, usable, paused, reset, onToggleDetails }: { level: number; usable: number; paused: boolean; reset: number; onToggleDetails: () => void }) {
  const time = useRef(0);
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const terrain = useMemo(makeTerrain, []);
  const trees = useMemo(() => {
    const mesh=new THREE.Mesh(terrain,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    const ray=new THREE.Raycaster();
    const result=[[-5.5,-2,1.1],[-4.6,-4.8,.8],[-2.8,-6.2,1],[5.6,-2.9,.9],[-5,.8,.9],[-4.1,1.5,1.15],[-3.9,4.5,.85],[4.1,2.7,1],[4.9,1.7,1.1],[4.6,3.4,.75]].map(([x,z,scale]) => {
      ray.set(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0));
      return {x,z,scale,y:ray.intersectObject(mesh)[0]?.point.y??0};
    });
    mesh.material.dispose(); return result;
  },[terrain]);
  const lake = useMemo(() => {
    const s = new THREE.Shape(); s.moveTo(-4.85,-.08); s.lineTo(4.85,-.08);
    for (let i=0;i<=24;i++) { const a=i/24*Math.PI; s.lineTo(Math.cos(a)*5.05,.22+Math.sin(a)*6.05); }
    s.closePath(); return new THREE.ShapeGeometry(s,24);
  }, []);
  const river = useMemo(() => {
    const s = new THREE.Shape(); s.moveTo(-1.9,-.7); s.lineTo(1.9,-.7); s.lineTo(2.65,-6.3);
    s.quadraticCurveTo(0,-7.9,-2.65,-6.3); s.closePath(); return new THREE.ShapeGeometry(s,20);
  }, []);
  const fall = useMemo(() => {
    const g = new THREE.PlaneGeometry(.94,1,10,32), p = g.attributes.position;
    for (let i=0;i<p.count;i++) { const t=.5-p.getY(i); p.setXYZ(i,p.getX(i),-t*2.45,t*.78+Math.sin(t*Math.PI)*.11); }
    g.computeVertexNormals(); return g;
  }, []);
  useEffect(() => () => { terrain.dispose(); lake.dispose(); river.dispose(); fall.dispose(); }, [terrain,lake,river,fall]);
  useFrame((_,delta) => { if (!paused && level > .005) time.current += Math.min(delta,.05); });
  const zoom = Math.min(size.width/19,size.height/15);
  useEffect(() => {
    const orbit=controls.current;
    // Drain orbit inertia before restoring the exact reference camera.
    if (orbit) { orbit.enableDamping=false; orbit.update(); }
    camera.position.set(-10,10,14);
    if (camera instanceof THREE.OrthographicCamera) { camera.zoom=zoom; camera.updateProjectionMatrix(); }
    if (orbit) { orbit.target.set(0,1.1,-.3); orbit.update(); orbit.enableDamping=true; }
  }, [camera,reset,zoom]);
  const strength = clamp(usable/.24,0,1);
  const select = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta<=4) onToggleDetails(); };
  return <>
    <ambientLight intensity={1.5} />
    <directionalLight position={[-5,12,6]} intensity={3} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={.04} />
    <mesh geometry={terrain} castShadow receiveShadow><meshStandardMaterial vertexColors flatShading roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0,-1.43,0]} scale={[1,1,.947]} receiveShadow><cylinderGeometry args={[6.75,6.75,.15,45]} /><meshStandardMaterial color="#8e8e98" flatShading /></mesh>
    <mesh geometry={lake} position={[0,1.65,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><meshStandardMaterial color="#bfc2c0" roughness={1} side={THREE.DoubleSide} /></mesh>
    <mesh geometry={river} position={[0,-.28,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><meshStandardMaterial color="#b8bfbd" roughness={1} side={THREE.DoubleSide} /></mesh>
    {level>.005 && <Water geometry={lake} position={[0,1.78+level*1.12,0]} rotation={[-Math.PI/2,0,0]} opacity={1} time={time} />}
    <Water geometry={river} position={[0,-.06,0]} rotation={[-Math.PI/2,0,0]} opacity={strength} time={time} />
    {[-3.55,3.55].map(x => <Box key={x} position={[x,1.45,.35]} size={[3.2,2.9,.62]} onClick={select} />)}
    {[-4.7,-3.8,-2.9,2.9,3.8,4.7].map(x => <Box key={x} position={[x,1.4,.663]} size={[.014,2.6,.006]} color="#c7c8c6" onClick={select} />)}
    <Box position={[0,2.95,.3]} size={[10.4,.32,.87]} color="#f1f0ed" onClick={select} />
    <Box position={[0,.2,.45]} size={[4.05,.4,1.25]} color="#bbbfbe" onClick={select} />
    {[-2.04,-.675,.675,2.04].map(x => <mesh key={x} position={[x,1.4,.67]} rotation={[-.14,0,0]} castShadow receiveShadow onClick={select}><boxGeometry args={[.36,2.85,.92]} /><meshStandardMaterial color="#dededb" roughness={.9} /></mesh>)}
    {[-1.35,0,1.35].map(x => <group key={x}>
      <Box position={[x,2.54,.12]} size={[1,.52,.3]} color="#748785" onClick={select} />
      <Water geometry={fall} position={[x,2.43,.64]} falls opacity={strength} time={time} />
    </group>)}
    {[-4.6,4.6].map(x => <mesh key={x} position={[x,1.35,.78]} rotation={[-.2,0,0]} castShadow receiveShadow onClick={select}><boxGeometry args={[.35,2.85,1.12]} /><meshStandardMaterial color="#d4d4d1" /></mesh>)}
    <Foam time={time} strength={strength} />
    {trees.map((tree,i) => <Tree key={i} {...tree} />)}
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.59,0]} receiveShadow><planeGeometry args={[200,200]} /><shadowMaterial transparent opacity={.13} /></mesh>
    <OrbitControls ref={controls} makeDefault target={[0,1.1,-.3]} enablePan={false} minZoom={zoom*.75} maxZoom={zoom*2.3} minPolarAngle={.3} maxPolarAngle={Math.PI/2.15} enableDamping dampingFactor={.08} />
  </>;
}

function ContextWatch({ onChange }: { onChange: (lost: boolean) => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onChange(true); };
    const restored = () => onChange(false);
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => { canvas.removeEventListener("webglcontextlost", lost); canvas.removeEventListener("webglcontextrestored", restored); };
  }, [gl, onChange]);
  return null;
}

class SceneBoundary extends Component<{ children: ReactNode },{ failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="dam-webgl-fallback" role="status">The 3D view is unavailable. Enable WebGL or try another browser. Reservoir controls and details are still available.</p> : this.props.children; }
}

export default function Reservoir({ level, protectedLevel=0, paused, reset, showDetails, showOverview, onToggleDetails }: ReservoirProps) {
  const actualPercent=clamp(level*100,0,100), protectedPercent=clamp(protectedLevel*100,0,100);
  // Show actual closing storage while reporting usable storage separately.
  const percent=protectedPercent>=100 ? 0 : clamp((actualPercent-protectedPercent)/(100-protectedPercent)*100,0,100);
  const usablePercent=clamp(actualPercent-protectedPercent,0,100);
  const [viewReset,setViewReset]=useState(0);
  const [reducedMotion,setReducedMotion]=useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [contextLost,setContextLost]=useState(false);
  const pointerStart=useRef<[number,number]>([0,0]);
  const dragged=useRef(false);
  useEffect(() => {
    const media=window.matchMedia("(prefers-reduced-motion: reduce)"), update=() => setReducedMotion(media.matches);
    media.addEventListener("change",update); return () => media.removeEventListener("change",update);
  },[]);
  return <section className={`dam-system-model dam-3d-model${actualPercent <= .5 ? ' is-empty' : ''}${paused || reducedMotion ? ' is-paused' : ''}`} data-level={Math.round(actualPercent)} data-usable-level={Math.round(usablePercent)} data-reset={reset} aria-label={`Interactive 3D reservoir: ${Math.round(actualPercent)} percent closing storage, ${Math.round(protectedPercent)} percent protected reserve, ${Math.round(usablePercent)} percent usable storage above reserve.`}
    onPointerDownCapture={e => { pointerStart.current=[e.clientX,e.clientY]; dragged.current=false; }}
    onPointerMoveCapture={e => { if(e.buttons && Math.hypot(e.clientX-pointerStart.current[0],e.clientY-pointerStart.current[1])>4) dragged.current=true; }}>
    <SceneBoundary>
      <Canvas orthographic shadows dpr={[1,1.5]} camera={{ position:[-10,10,14],zoom:40,near:.1,far:200 }} gl={{ antialias:true }} onCreated={({ gl }) => { gl.setClearColor("#f7f8f7"); }} onContextMenu={e => e.preventDefault()}>
        <ContextWatch onChange={setContextLost} />
        <Scene level={actualPercent/100} usable={percent/100} paused={paused||reducedMotion||contextLost} reset={reset+viewReset} onToggleDetails={() => { if(!dragged.current) onToggleDetails(); }} />
      </Canvas>
    </SceneBoundary>
    {contextLost && <p className="dam-webgl-fallback" role="status">The 3D graphics connection was lost. Reload to restore the view. Reservoir controls and details are still available.</p>}
    <span className="dam-3d-hint">Drag to rotate · Scroll to zoom</span>
    <div className="dam-3d-controls">
      <button type="button" onClick={() => setViewReset(v => v+1)}>Reset view</button>
      <button type="button" aria-expanded={showOverview || showDetails} onClick={onToggleDetails}>{showOverview || showDetails ? "Hide summary and details" : "Show summary and details"}</button>
    </div>
  </section>;
}
