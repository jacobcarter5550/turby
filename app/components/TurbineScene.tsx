'use client'

import { useRef, useMemo, useCallback, useEffect, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Line, Stars } from '@react-three/drei'
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
    // Derived from bladeShape.svg (viewBox 0 0 74 272)
    // Transform: x_3d = (svg_x - xo) * sc,  y_3d = (272 - svg_y) * sc
    // xo = midpoint of root base (3.516+27.516)/2 = 15.516 — centers root on the hub axle
    // sc = 4/272 so the blade tip sits ~4 units from hub
    const sc = 4 / 272
    const xo = 15.516

    const s = new THREE.Shape()
    // Root — left side
    s.moveTo((3.516 - xo) * sc,  (272 - 267)   * sc)
    // Root base
    s.lineTo((27.516 - xo) * sc, (272 - 270.5) * sc)
    s.lineTo((27.516 - xo) * sc, (272 - 266)   * sc)
    s.lineTo((29.516 - xo) * sc, (272 - 262.5) * sc)
    s.lineTo((31.016 - xo) * sc, (272 - 258.5) * sc)
    s.lineTo((37.516 - xo) * sc, (272 - 251)   * sc)
    s.lineTo((41.516 - xo) * sc, (272 - 245)   * sc)
    // Leading edge sweeps outward
    s.lineTo((53.016 - xo) * sc, (272 - 190.5) * sc)
    s.lineTo((66.016 - xo) * sc, (272 - 133.5) * sc)
    s.lineTo((70.516 - xo) * sc, (272 - 112)   * sc)
    s.lineTo((73.016 - xo) * sc, (272 - 85.5)  * sc)
    s.lineTo((73.016 - xo) * sc, (272 - 66)    * sc)
    // Leading edge narrows toward tip
    s.lineTo((71.516 - xo) * sc, (272 - 51.5)  * sc)
    s.lineTo((67.516 - xo) * sc, (272 - 36)    * sc)
    s.lineTo((59.016 - xo) * sc, (272 - 18.5)  * sc)
    s.lineTo((50.016 - xo) * sc, (272 - 6)     * sc)
    s.lineTo((43.516 - xo) * sc, (272 - 0.5)   * sc)
    // Tip
    s.lineTo((35.516 - xo) * sc, (272 - 0.5)   * sc)
    // Trailing edge sweeps back down
    s.lineTo((46.016 - xo) * sc, (272 - 14)    * sc)
    s.lineTo((52.516 - xo) * sc, (272 - 26)    * sc)
    s.lineTo((52.516 - xo) * sc, (272 - 56.5)  * sc)
    s.lineTo((52.516 - xo) * sc, (272 - 78.5)  * sc)
    s.lineTo((51.516 - xo) * sc, (272 - 106.5) * sc)
    s.lineTo((42.516 - xo) * sc, (272 - 136.5) * sc)
    s.lineTo((29.516 - xo) * sc, (272 - 169.5) * sc)
    s.lineTo((16.516 - xo) * sc, (272 - 199.5) * sc)
    s.lineTo((2.516  - xo) * sc, (272 - 228.5) * sc)
    s.lineTo((0.516  - xo) * sc, (272 - 232.5) * sc)
    s.lineTo((1.516  - xo) * sc, (272 - 240)   * sc)
    s.lineTo((2.516  - xo) * sc, (272 - 243.5) * sc)
    s.lineTo((5.016  - xo) * sc, (272 - 249)   * sc)
    s.lineTo((5.016  - xo) * sc, (272 - 254)   * sc)
    s.lineTo((5.016  - xo) * sc, (272 - 261)   * sc)
    // Back to root
    s.lineTo((3.516  - xo) * sc, (272 - 267)   * sc)
    s.closePath()
    return s
  }, [])

  const extrudeSettings = useMemo(
    () => ({
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 3,
    }),
    []
  )

  return (
    <mesh castShadow position={[0, 0, -0.03]}>
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
    config: { mass: 2.8, tension: 22, friction: 18 },
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
      // Record start state but don't stop the spring yet — wait for actual movement
      prevAngle.current = getAngle(e.nativeEvent.clientX, e.nativeEvent.clientY)
      prevTime.current = performance.now()
      dragVel.current = velSpring.vel.get()
      gl.domElement.style.cursor = 'grabbing'

      const onMove = (ev: PointerEvent) => {
        if (!groupRef.current) return
        // Engage drag on first real movement
        if (!isDragging.current) {
          isDragging.current = true
          velApi.stop()
        }
        const now = performance.now()
        const dt = (now - prevTime.current) / 1000
        const angle = getAngle(ev.clientX, ev.clientY)

        let dA = angle - prevAngle.current
        if (dA > Math.PI) dA -= 2 * Math.PI
        if (dA < -Math.PI) dA += 2 * Math.PI

        // Clockwise only — discard any counter-clockwise delta
        const cwDA = Math.min(0, dA)
        groupRef.current.rotation.z += cwDA
        if (dt > 0.001) dragVel.current = Math.min(0, cwDA / dt)

        prevAngle.current = angle
        prevTime.current = now
      }

      const onUp = () => {
        if (isDragging.current) {
          isDragging.current = false
          velApi.start({
            from: { vel: Math.max(-20, Math.min(0, dragVel.current)) },
            vel: BASE_SPEED,
          })
        }
        gl.domElement.style.cursor = 'grab'
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [getAngle, gl, velApi, velSpring]
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
      {/* Hub — football shape elongated along the z axle */}
      <mesh castShadow scale={[0.22, 0.22, 0.48]}>
        <sphereGeometry args={[1, 20, 14]} />
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

      {/* Nacelle — football/prolate-spheroid, elongated along z */}
      <mesh position={[0, nacY, -0.1]} castShadow scale={[0.38, 0.30, 0.92]}>
        <sphereGeometry args={[1, 32, 20]} />
        <meshStandardMaterial color="#d5d9de" roughness={0.65} metalness={0.14} />
      </mesh>

      <group position={[0, nacY, 0.74]}>
        <Rotor />
      </group>
    </group>
  )
}

// ── Sky ───────────────────────────────────────────────────────────────────────

function GradientSky({ isRainy, isNight }: { isRainy: boolean; isNight: boolean }) {
  const mat = useMemo(() => {
    const [top, mid, bot] = isNight
      ? ['#0a0e2a', '#111833', '#1a0a30']
      : isRainy
        ? ['#5a6070', '#7a8898', '#6a7a88']
        : ['#CCEDFF', '#9BD7EE', '#09D6FF']
    return new THREE.ShaderMaterial({
    uniforms: {
      topColor:    { value: new THREE.Color(top) },
      midColor:    { value: new THREE.Color(mid) },
      bottomColor: { value: new THREE.Color(bot) },
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
  })
  }, [isRainy, isNight])

  return (
    <mesh scale={400} renderOrder={-1}>
      <sphereGeometry args={[1, 24, 12]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

// ── Ground ────────────────────────────────────────────────────────────────────

function Ground({ isRainy, isNight }: { isRainy: boolean; isNight: boolean }) {
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
  const groundColor = isNight ? '#4a6a2a' : isRainy ? '#2a3d14' : '#3a5a1a'
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]} receiveShadow>
      <planeGeometry args={[160, 160, 100, 100]} />
      <meshStandardMaterial color={groundColor} roughness={1} />
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

    // 4 rows on the mid front face of the hill (wz -6 → -19)
    // Tighter band, smaller scale — below the hilltop cluster
    for (let row = 0; row < 4; row++) {
      const t = row / 3                        // 0 = lower, 1 = upper
      const baseZ = -6 - t * 8              // wz: -6 → -14
      const halfSpan = 10 - t * 3              // half-width: 10 → 7
      const centerX = -2
      const colCount = 6 + Math.floor(rand() * 3)

      for (let col = 0; col < colCount; col++) {
        const wx = (centerX - halfSpan) + (2 * halfSpan) * (col / Math.max(colCount - 1, 1)) + (rand() - 0.5) * 2
        const wz = baseZ + (rand() - 0.5) * 2.5
        const ht = terrainHeight(wx, wz)

        if (ht < 1.1) continue

        pts.push({
          wx, wz,
          scale: 0.7 + rand() * 0.3,
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

// ── Trees ─────────────────────────────────────────────────────────────────────

const TREE_MODEL = '/models/tree.glb'
useGLTF.preload(TREE_MODEL)

const GREEN_TREE_NAMES = [
  'Lowpolytree_01_green',
  'Lowpolytree_02_green',
  'Lowpolytree_03_green',
  'Lowpolytree_4_green',
  'Lowpolytree_5_green',
  'Lowpolytree_6_green',
]

const TARGET_TREE_HEIGHT = 3.2

interface TreePos { wx: number; wz: number; scale: number; ry: number; variant: number }

function TreeInstance({ wx, wz, scale, ry, variant }: TreePos) {
  const { scene } = useGLTF(TREE_MODEL)
  const { clone, finalScale, yOffset } = useMemo(() => {
    const targetName = GREEN_TREE_NAMES[variant % GREEN_TREE_NAMES.length]

    // Clone the full scene so hierarchy and materials are intact
    const clone = scene.clone(true)

    // Hide all non-target color variants
    clone.traverse((obj) => {
      const n = obj.name
      if (!n) return
      const isNonGreen = n.includes('_blue') || n.includes('_orange') || n.includes('_yellow') || n.includes('Pine')
      const isWrongGreen = GREEN_TREE_NAMES.some(g => g !== targetName && n.startsWith(g))
      if (isNonGreen || isWrongGreen) obj.visible = false
    })

    // Compute bounding box from the target node's meshes with correct world transforms
    clone.updateWorldMatrix(false, true)
    const targetNode = clone.getObjectByName(targetName)
    const box = new THREE.Box3()
    if (targetNode) {
      targetNode.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) box.expandByObject(child)
      })
    } else {
      box.setFromObject(clone)
    }

    const height = box.getSize(new THREE.Vector3()).y
    const normalizedScale = height > 0 ? (TARGET_TREE_HEIGHT / height) * scale : scale
    const yOffset = height > 0 ? -box.min.y * normalizedScale : 0
    return { clone, finalScale: normalizedScale, yOffset }
  }, [scene, scale, variant])

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

function Trees() {
  const positions = useMemo<TreePos[]>(() => {
    const rand = seededRand(77)
    const pts: TreePos[] = []

    // Upper-boundary band: wz -10 to -14
    const bandCount = 14
    for (let i = 0; i < bandCount; i++) {
      const wx = (-2 - 11) + (22 * (i / (bandCount - 1))) + (rand() - 0.5) * 2.5
      const wz = -10 - rand() * 4      // spread across -10 → -14
      const ht = terrainHeight(wx, wz)
      if (ht < 1.5) continue
      pts.push({ wx, wz, scale: 0.8 + rand() * 0.4, ry: rand() * Math.PI * 2, variant: Math.floor(rand() * GREEN_TREE_NAMES.length) })
    }

    // Hilltop cluster: tight ring near peak (wx≈4, wz≈-38)
    const hilltopCount = 5
    for (let i = 0; i < hilltopCount; i++) {
      const wx = 2 + (rand() - 0.5) * .5
      const wz = -40 - rand() * 1
      pts.push({ wx, wz, scale: 0.9 + rand() * 0.3, ry: rand() * Math.PI * 2, variant: Math.floor(rand() * GREEN_TREE_NAMES.length) })
    }

    return pts
  }, [])

  return (
    <Suspense fallback={null}>
      {positions.map((pos, i) => <TreeInstance key={i} {...pos} />)}
    </Suspense>
  )
}

// ── Lights ────────────────────────────────────────────────────────────────────

// Sun direction — shared between Sky shader and shadow-casting light
const SUN: [number, number, number] = [3, 10, 5]

function Lights({ isRainy, isNight }: { isRainy: boolean; isNight: boolean }) {
  const hemiSky    = isNight ? '#4a5880' : isRainy ? '#7a8898' : '#7ec8f0'
  const hemiGround = isNight ? '#2a3828' : isRainy ? '#1e2818' : '#2a4820'
  const hemiInt    = isNight ? 1.0       : isRainy ? 0.25      : 0.35
  const dirColor   = isNight ? '#99aadd' : isRainy ? '#aab0b8' : '#fff5e0'
  const dirInt     = isNight ? 1.1       : isRainy ? 0.6       : 2.2
  const fillInt    = isNight ? 0.45      : isRainy ? 0.08      : 0.12
  return (
    <>
      <hemisphereLight args={[hemiSky, hemiGround, hemiInt]} />
      <directionalLight
        position={SUN}
        intensity={dirInt}
        color={dirColor}
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
      <directionalLight position={[-5, 6, -8]} intensity={fillInt} color="#88b8d8" />
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

function Cloud({ seed, isRainy }: CloudProps & { isRainy: boolean }) {
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

  // Starting position & drift — lower altitude when rainy
  const init = useMemo(() => ({
    x:     (r(20) - 0.5) * 80,
    y:     isRainy ? (4 + r(21) * 5) : (8 + r(21) * 10),
    z:     (r(22) - 0.5) * 80,
    speed: 0.35 + r(23) * 0.45,
    range: 35 + r(24) * 30,
  }), [r, isRainy])

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
            color={isRainy ? '#8a9aaa' : '#f0f6ff'}
            roughness={1}
            metalness={0}
            transparent
            opacity={isRainy ? 0.95 : 0.88}
          />
        </mesh>
      ))}
    </group>
  )
}

function Clouds({ isRainy }: { isRainy: boolean }) {
  const count = isRainy ? 28 : 14
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Cloud key={i} seed={i + 1} isRainy={isRainy} />
      ))}
    </>
  )
}

// ── Rain ──────────────────────────────────────────────────────────────────────

const RAIN_COUNT = 1500

function Rain() {
  const pointsRef = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const arr = new Float32Array(RAIN_COUNT * 3)
    for (let i = 0; i < RAIN_COUNT; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 80
      arr[i * 3 + 1] = Math.random() * 30 - 4
      arr[i * 3 + 2] = (Math.random() - 0.5) * 80
    }
    return arr
  }, [])

  const speeds = useMemo(() => {
    const arr = new Float32Array(RAIN_COUNT)
    for (let i = 0; i < RAIN_COUNT; i++) arr[i] = 12 + Math.random() * 8
    return arr
  }, [])

  useFrame((_, delta) => {
    if (!pointsRef.current) return
    const pos = (pointsRef.current.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
    for (let i = 0; i < RAIN_COUNT; i++) {
      pos[i * 3 + 1] -= speeds[i] * delta
      if (pos[i * 3 + 1] < -4) {
        pos[i * 3 + 0] = (Math.random() - 0.5) * 80
        pos[i * 3 + 1] = 26
        pos[i * 3 + 2] = (Math.random() - 0.5) * 80
      }
    }
    ;(pointsRef.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#aac8e0" size={0.08} sizeAttenuation transparent opacity={0.6} depthWrite={false} />
    </points>
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
  const [{ isRainy, isNight }, setWeather] = useState({ isRainy: false, isNight: false })

  useEffect(() => {
    fetch('/api/weather')
      .then(r => r.json())
      .then(setWeather)
      .catch(() => {})
  }, [])

  const fogColor = isNight ? '#06091a' : isRainy ? '#8a9aaa' : '#7ab8e8'
  const fogNear  = isNight ? 30 : isRainy ? 20 : 35
  const fogFar   = isNight ? 70 : isRainy ? 55 : 80

  return (
    <Canvas
      camera={{ position: [2.02, 4.18, 8.79], fov: 56 }}
      shadows
      dpr={[1, 2]}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      style={{ width: '100%', height: '100%' }}
    >
      <CameraSetup />
      <GradientSky isRainy={isRainy} isNight={isNight} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
      <Lights isRainy={isRainy} isNight={isNight} />
      <WindTurbine />
      <Ground isRainy={isRainy} isNight={isNight} />
      <FluffyGrassField />
      <Houses />
      <Trees />
      <Clouds isRainy={isRainy} />
      <WindGusts />
      {isRainy && <Rain />}
      {isNight && <Stars radius={80} depth={50} count={3000} factor={4} saturation={0} fade speed={0} />}
    </Canvas>
  )
}
