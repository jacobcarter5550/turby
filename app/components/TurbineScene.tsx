'use client'

import { useRef, useMemo, useCallback, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Line } from '@react-three/drei'
import { useSpring } from '@react-spring/three'
import * as THREE from 'three'
import { GrassMaterial } from './GrassMaterial'

const BASE_SPEED = -0.42

// ── Shared terrain height formula ─────────────────────────────────────────────
function terrainHeight(wx: number, wz: number): number {
  const h1dx = wx - 4, h1dz = wz + 38
  const hill1 = 16 * Math.exp(-(h1dx * h1dx) / (2 * 20 * 20) - (h1dz * h1dz) / (2 * 28 * 28))
  const h2dx = wx + 18, h2dz = wz + 55
  const hill2 = 9 * Math.exp(-(h2dx * h2dx) / (2 * 15 * 15) - (h2dz * h2dz) / (2 * 18 * 18))
  const roll = 0.6 * Math.sin(wx * 0.09 + 1.3) * Math.cos(wz * 0.07)
    + 0.35 * Math.sin(wx * 0.17 + 0.4) * Math.sin(wz * 0.13 + 0.9)
  const proximity = Math.exp(-Math.sqrt(wx * wx + wz * wz) / 10)
  return (hill1 + hill2 + roll) * (1 - proximity)
}

function seededRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ── Blade ─────────────────────────────────────────────────────────────────────

function Blade() {
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0.22, -0.08)
    s.lineTo(0.28, 0.28)
    s.lineTo(0.11, 0.68)
    s.bezierCurveTo(0.04, 1.55, -0.50, 2.85, -1.26, 3.72)
    s.quadraticCurveTo(-1.38, 3.90, -1.32, 3.96)
    s.bezierCurveTo(-1.14, 3.92, -0.38, 2.85, -0.06, 1.55)
    s.lineTo(-0.07, 0.68)
    s.lineTo(-0.18, 0.28)
    s.lineTo(-0.16, -0.08)
    s.closePath()
    return s
  }, [])

  const extrudeSettings = useMemo(
    () => ({
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 2,
    }),
    []
  )

  return (
    <mesh castShadow position={[0, 0, -0.02]}>
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial color="#e2e6ea" roughness={0.25} metalness={0.2} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ── Rotor ─────────────────────────────────────────────────────────────────────

function Rotor() {
  const groupRef = useRef<THREE.Group>(null)
  const { camera, gl } = useThree()

  const isDragging = useRef(false)
  const prevAngle = useRef(0)
  const prevTime = useRef(0)
  const dragVel = useRef(BASE_SPEED)

  const [velSpring, velApi] = useSpring(() => ({
    vel: BASE_SPEED,
    config: { mass: 1.2, tension: 38, friction: 15 },
  }))

  useFrame((_, delta) => {
    if (!groupRef.current || isDragging.current) return
    groupRef.current.rotation.z += velSpring.vel.get() * delta
  })

  const getAngle = useCallback(
    (clientX: number, clientY: number): number => {
      if (!groupRef.current) return 0
      const rect = gl.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      )
      const ray = new THREE.Raycaster()
      ray.setFromCamera(ndc, camera)

      const hub = new THREE.Vector3()
      groupRef.current.getWorldPosition(hub)

      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -hub.z)
      const hit = new THREE.Vector3()
      if (!ray.ray.intersectPlane(plane, hit)) return prevAngle.current

      return Math.atan2(hit.y - hub.y, hit.x - hub.x)
    },
    [camera, gl]
  )

  const onPointerDown = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      e.stopPropagation()
      isDragging.current = true
      velApi.stop()
      prevAngle.current = getAngle(e.nativeEvent.clientX, e.nativeEvent.clientY)
      prevTime.current = performance.now()
      gl.domElement.style.cursor = 'grabbing'

      const onMove = (ev: PointerEvent) => {
        if (!isDragging.current || !groupRef.current) return
        const now = performance.now()
        const dt = (now - prevTime.current) / 1000
        const angle = getAngle(ev.clientX, ev.clientY)

        let dA = angle - prevAngle.current
        if (dA > Math.PI) dA -= 2 * Math.PI
        if (dA < -Math.PI) dA += 2 * Math.PI

        groupRef.current.rotation.z += dA
        if (dt > 0.001) dragVel.current = dA / dt

        prevAngle.current = angle
        prevTime.current = now
      }

      const onUp = () => {
        isDragging.current = false
        velApi.start({
          from: { vel: Math.max(-8, Math.min(8, dragVel.current)) },
          vel: BASE_SPEED,
        })
        gl.domElement.style.cursor = 'grab'
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [getAngle, gl, velApi]
  )

  const bladeAngles = useMemo(
    () => [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3],
    []
  )

  return (
    <group
      ref={groupRef}
      onPointerDown={onPointerDown}
      onPointerEnter={() => { gl.domElement.style.cursor = 'grab' }}
      onPointerLeave={() => { if (!isDragging.current) gl.domElement.style.cursor = 'auto' }}
    >
      <mesh castShadow>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshStandardMaterial color="#d5d9de" roughness={0.45} metalness={0.15} />
      </mesh>
      {bladeAngles.map((angle, i) => (
        <group key={i} rotation={[0, 0, angle]}>
          <Blade />
        </group>
      ))}
    </group>
  )
}

// ── Turbine ───────────────────────────────────────────────────────────────────

function WindTurbine() {
  const nacY = 4.3

  return (
    <group>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.18, 0.44, 8, 10]} />
        <meshStandardMaterial color="#c2c6ca" roughness={0.88} metalness={0.06} />
      </mesh>

      <mesh position={[0, -3.9, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.6, 0.65, 0.2, 10]} />
        <meshStandardMaterial color="#b8bcc0" roughness={0.9} metalness={0.05} />
      </mesh>

      <mesh position={[0, nacY, 0]} castShadow>
        <boxGeometry args={[0.72, 0.6, 1.65]} />
        <meshStandardMaterial color="#d5d9de" roughness={0.72} metalness={0.12} />
      </mesh>

      <mesh position={[0, nacY + 0.37, -0.1]} castShadow>
        <boxGeometry args={[0.5, 0.12, 1.0]} />
        <meshStandardMaterial color="#cdd0d4" roughness={0.8} metalness={0.08} />
      </mesh>

      <mesh position={[0, nacY, 0.92]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.23, 0.5, 10]} />
        <meshStandardMaterial color="#dde1e6" roughness={0.4} metalness={0.15} />
      </mesh>

      <group position={[0, nacY, 0.74]}>
        <Rotor />
      </group>
    </group>
  )
}

// ── Sky ───────────────────────────────────────────────────────────────────────

function GradientSky() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      topColor:    { value: new THREE.Color('#CCEDFF') },
      midColor:    { value: new THREE.Color('#9BD7EE') },
      bottomColor: { value: new THREE.Color('#09D6FF') },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y; // -1 to 1
        vec3 col = h > 0.0
          ? mix(midColor, topColor, min(h * 2.0, 1.0))
          : mix(bottomColor, midColor, max(h + 1.0, 0.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  }), [])

  return (
    <mesh scale={400} renderOrder={-1}>
      <sphereGeometry args={[1, 24, 12]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

// ── Ground ────────────────────────────────────────────────────────────────────

function Ground() {
  const ref = useRef<THREE.Mesh>(null)
  useEffect(() => {
    if (!ref.current) return
    const geo = ref.current.geometry as THREE.PlaneGeometry
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, terrainHeight(pos.getX(i), -pos.getY(i)))
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
  }, [])
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]} receiveShadow>
      <planeGeometry args={[160, 160, 100, 100]} />
      <meshStandardMaterial color="#3a5a1a" roughness={1} />
    </mesh>
  )
}

// ── Fluffy Grass ──────────────────────────────────────────────────────────────

useGLTF.preload('/grassLODs.glb')

const GRASS_COUNT = 20000

function FluffyGrassField() {
  const { scene: grassScene } = useGLTF('/grassLODs.glb')

  // Material is stable — no grassScene dependency, safe to reference directly in useFrame
  const gMat = useMemo(() => {
    const loader = new THREE.TextureLoader()
    const grassTex = loader.load('/grass.jpeg')
    const noiseTex = loader.load('/perlinnoise.webp')
    noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping
    const mat = new GrassMaterial()
    mat.setupTextures(grassTex, noiseTex)
    return mat
  }, [])

  // Mesh depends on geometry from the GLB
  const instancedMesh = useMemo(() => {
    let geo: THREE.BufferGeometry | null = null
    grassScene.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh && mesh.name.includes('LOD00') && !geo) {
        geo = mesh.geometry.clone()
        geo.scale(5, 5, 5)
      }
    })
    if (!geo) return null

    const mesh = new THREE.InstancedMesh(geo, gMat.material, GRASS_COUNT)
    mesh.receiveShadow = true

    const pos  = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl  = new THREE.Vector3()
    const mat4 = new THREE.Matrix4()
    let placed = 0
    while (placed < GRASS_COUNT) {
      const wx = (Math.random() - 0.5) * 155
      const wz = (Math.random() - 0.5) * 155
      if (Math.sqrt(wx * wx + wz * wz) < 2.5) continue
      const wy = terrainHeight(wx, wz) - 4
      quat.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0))
      const s = 0.9 + Math.random() * 0.7
      pos.set(wx, wy, wz)
      scl.set(s, s, s)
      mat4.compose(pos, quat, scl)
      mesh.setMatrixAt(placed, mat4)
      placed++
    }
    mesh.instanceMatrix.needsUpdate = true
    return mesh
  }, [grassScene, gMat])

  // Direct reference — no matRef indirection that could go stale
  useFrame(({ clock }) => {
    gMat.update(clock.elapsedTime)
  })

  if (!instancedMesh) return null
  return <primitive object={instancedMesh} />
}

// ── Houses ────────────────────────────────────────────────────────────────────

const HOUSE_MODELS = [
  '/models/house.glb',   // House — Poly by Google (CC-BY 3.0)
  '/models/house3.glb',  // House — Quaternius (CC0)
  '/models/house4.glb',  // Small House — Jarlan Perez (CC-BY 3.0)
  '/models/house5.glb',  // Farm House (CC-BY 3.0)
  '/models/house6.glb',  // House (CC0)
  '/models/house8.glb',  // House — Quaternius (CC0)
  '/models/house9.glb',  // Cottage (CC0)
]
HOUSE_MODELS.forEach(m => useGLTF.preload(m))

// Target house height in world units — keeps all models visually the same size
const TARGET_HOUSE_HEIGHT = 2.5

interface HousePos { wx: number; wz: number; scale: number; ry: number; model: string }

function HouseInstance({ wx, wz, scale, ry, model }: HousePos) {
  const { scene } = useGLTF(model)

  const { clone, finalScale, yOffset } = useMemo(() => {
    const clone = scene.clone(true)
    const box = new THREE.Box3().setFromObject(clone)
    const height = box.getSize(new THREE.Vector3()).y
    const normalizedScale = height > 0 ? (TARGET_HOUSE_HEIGHT / height) * scale : scale
    const yOffset = height > 0 ? -box.min.y * normalizedScale : 0
    return { clone, finalScale: normalizedScale, yOffset }
  }, [scene, scale])

  return (
    <primitive
      object={clone}
      position={[wx, -4 + terrainHeight(wx, wz) + yOffset, wz]}
      rotation={[0, ry, 0]}
      scale={finalScale}
      castShadow
      receiveShadow
    />
  )
}

function Houses() {
  const positions = useMemo<HousePos[]>(() => {
    const rand = seededRand(42)
    const pts: HousePos[] = []

    // 5 rows climbing the front face of the hill (wz -20 → -44)
    // Hill peak: wx≈4, wz≈-38 — spread narrows as rows climb toward peak
    for (let row = 0; row < 5; row++) {
      const t = row / 4                        // 0 = base of slope, 1 = near peak
      const baseZ = -20 - t * 24            // wz: -20 (base) → -44 (near peak)
      const halfSpan = 16 - t * 5              // half-width: 16 → 11 (narrows up the hill)
      const centerX = 4                       // follow hill's X center
      const colCount = 7 + Math.floor(rand() * 4)

      for (let col = 0; col < colCount; col++) {
        const wx = (centerX - halfSpan) + (2 * halfSpan) * (col / Math.max(colCount - 1, 1)) + (rand() - 0.5) * 2
        const wz = baseZ + (rand() - 0.5) * 3
        const ht = terrainHeight(wx, wz)

        if (ht < 3) continue   // must be on the hill proper

        pts.push({
          wx, wz,
          scale: 0.85 + rand() * 0.3,
          ry: rand() * Math.PI * 2,
          model: HOUSE_MODELS[Math.floor(rand() * HOUSE_MODELS.length)],
        })
      }
    }
    return pts
  }, [])

  return (
    <Suspense fallback={null}>
      {positions.map((pos, i) => <HouseInstance key={i} {...pos} />)}
    </Suspense>
  )
}

// ── Lights ────────────────────────────────────────────────────────────────────

// Sun direction — shared between Sky shader and shadow-casting light
const SUN: [number, number, number] = [3, 10, 5]

function Lights() {
  return (
    <>
      {/* Sky/ground hemisphere */}
      <hemisphereLight args={['#7ec8f0', '#2a4820', 0.35]} />
      {/* Hard sun — bright and directional */}
      <directionalLight
        position={SUN}
        intensity={2.2}
        color="#fff5e0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={70}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      {/* Soft sky fill from opposite side */}
      <directionalLight position={[-5, 6, -8]} intensity={0.12} color="#88b8d8" />
    </>
  )
}

// ── Wind gusts ────────────────────────────────────────────────────────────────

const RIBBON_PTS = 28

function WindRibbon({ index }: { index: number }) {
  const lineRef = useRef<any>(null)

  const r = useMemo(() => (n: number) => {
    const x = Math.sin((index + 1) * 127.1 + n * 311.7) * 43758.5453
    return x - Math.floor(x)
  }, [index])

  const params = useMemo(() => ({
    baseX:      r(1) * 22 - 11,
    baseY:      r(2) * 10 + 0.5,
    cycleSpeed: 0.35 + r(3) * 0.55,
    windowSize: 0.35 + r(4) * 0.40,
    waveAmpX:   1.0  + r(5) * 2.2,
    waveAmpY:   0.3  + r(6) * 0.9,
    waveFreq:   0.4  + r(7) * 1.1,
    wavePhase:  r(8) * Math.PI * 2,
    delay:      r(9) * 14,
    maxOpacity: 0.35 + r(10) * 0.30,
    lineWidth:  1.5  + r(11) * 2.5,
  }), [r])

  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 14),
    new THREE.Vector3(0, 0,  6),
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 0, -8),
    new THREE.Vector3(0, 0,-16),
  ]), [])

  const initialPoints = useMemo(() =>
    Array.from({ length: RIBBON_PTS }, (_, i) =>
      curve.getPoint(i / (RIBBON_PTS - 1))
    ), [curve])

  useFrame(({ clock }) => {
    if (!lineRef.current) return
    const t      = clock.elapsedTime + params.delay
    const cycleT = (t * params.cycleSpeed) % 1

    const fade = cycleT < 0.15
      ? cycleT / 0.15
      : cycleT > 0.82
        ? (1 - cycleT) / 0.18
        : 1
    lineRef.current.material.opacity = fade * params.maxOpacity

    const wX = params.waveAmpX * Math.sin(t * params.waveFreq + params.wavePhase)
    const wY = params.waveAmpY * Math.sin(t * params.waveFreq * 1.4 + params.wavePhase + 1.5)
    curve.points[0].set(params.baseX,              params.baseY,              14)
    curve.points[1].set(params.baseX + wX * 0.5,  params.baseY + wY,          6)
    curve.points[2].set(params.baseX - wX * 0.3,  params.baseY - wY * 0.6,   -1)
    curve.points[3].set(params.baseX + wX * 0.7,  params.baseY + wY * 0.4,   -8)
    curve.points[4].set(params.baseX,              params.baseY,             -16)

    const start = cycleT * (1 - params.windowSize)
    const positions: number[] = []
    for (let i = 0; i < RIBBON_PTS; i++) {
      const u = Math.min(start + (i / (RIBBON_PTS - 1)) * params.windowSize, 0.999)
      const p = curve.getPoint(u)
      positions.push(p.x, p.y, p.z)
    }
    lineRef.current.geometry.setPositions(positions)
  })

  return (
    <Line
      ref={lineRef}
      points={initialPoints}
      color="#c8dff0"
      lineWidth={params.lineWidth}
      transparent
      opacity={0}
      depthWrite={false}
    />
  )
}

function WindGusts() {
  return (
    <>
      {Array.from({ length: 20 }, (_, i) => (
        <WindRibbon key={i} index={i} />
      ))}
    </>
  )
}

// ── Clouds ────────────────────────────────────────────────────────────────────

interface CloudProps { seed: number }

function Cloud({ seed }: CloudProps) {
  const groupRef = useRef<THREE.Group>(null)

  const r = useMemo(() => (n: number) => {
    const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453
    return x - Math.floor(x)
  }, [seed])

  // Cloud shape — 6-9 puffs of varying size
  const puffs = useMemo(() => {
    const count = 6 + Math.floor(r(0) * 4)
    return Array.from({ length: count }, (_, i) => ({
      x: (r(i * 5 + 1) - 0.5) * 4.5,
      y: (r(i * 5 + 2) - 0.3) * 1.2,
      z: (r(i * 5 + 3) - 0.5) * 2.0,
      s: 0.8 + r(i * 5 + 4) * 1.4,
    }))
  }, [r])

  // Starting position & drift
  const init = useMemo(() => ({
    x:     (r(20) - 0.5) * 80,
    y:     8 + r(21) * 10,
    z:     (r(22) - 0.5) * 80,
    speed: 0.35 + r(23) * 0.45,
    range: 35 + r(24) * 30,
  }), [r])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.elapsedTime * init.speed
    groupRef.current.position.x = init.x + Math.sin(t * 0.12) * init.range
    groupRef.current.position.z = init.z + Math.cos(t * 0.07) * (init.range * 0.4)
  })

  return (
    <group ref={groupRef} position={[init.x, init.y, init.z]}>
      {puffs.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} castShadow>
          <sphereGeometry args={[p.s, 7, 5]} />
          <meshStandardMaterial
            color="#f0f6ff"
            roughness={1}
            metalness={0}
            transparent
            opacity={0.88}
          />
        </mesh>
      ))}
    </group>
  )
}

function Clouds() {
  return (
    <>
      {Array.from({ length: 14 }, (_, i) => (
        <Cloud key={i} seed={i + 1} />
      ))}
    </>
  )
}

// ── Canvas ────────────────────────────────────────────────────────────────────

function CameraSetup() {
  const { camera } = useThree()
  useEffect(() => {
    camera.lookAt(0, 3.5, 0)
  }, [camera])
  return null
}

export default function TurbineScene() {
  return (
    <Canvas
      camera={{ position: [2.02, 4.18, 8.79], fov: 56 }}
      shadows
      dpr={[1, 2]}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      style={{ width: '100%', height: '100%' }}
    >
      <CameraSetup />
      <GradientSky />
      <fog attach="fog" args={['#7ab8e8', 35, 80]} />
      <Lights />
      <WindTurbine />
      <Ground />
      <FluffyGrassField />
      <Houses />
      <Clouds />
      <WindGusts />
    </Canvas>
  )
}
