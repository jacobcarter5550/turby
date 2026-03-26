import * as THREE from "three";

function makePixel(r: number, g: number, b: number): THREE.DataTexture {
	const tex = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1)
	tex.needsUpdate = true
	return tex
}

export class GrassMaterial {
	material: THREE.Material;

	uniforms: { [key: string]: { value: any } } = {
		uTime:               { value: 0 },
		uEnableShadows:      { value: true },
		uShadowDarkness:     { value: 0.5 },
		uGrassLightIntensity:{ value: 1 },
		uNoiseScale:         { value: 1.5 },
		baseColor:           { value: new THREE.Color("#313f1b") },
		tipColor1:           { value: new THREE.Color("#9bd38d") },
		tipColor2:           { value: new THREE.Color("#1f352a") },
		noiseTexture:        { value: makePixel(128, 128, 128) },
		grassAlphaTexture:   { value: makePixel(255, 255, 255) },  // white = fully visible until real texture loads
	};

	constructor(props?: {
		baseColor?: THREE.Color;
		tipColor1?: THREE.Color;
		tipColor2?: THREE.Color;
	}) {
		if (props?.baseColor) this.uniforms.baseColor.value = props.baseColor;
		if (props?.tipColor1) this.uniforms.tipColor1.value = props.tipColor1;
		if (props?.tipColor2) this.uniforms.tipColor2.value = props.tipColor2;

		this.material = new THREE.MeshLambertMaterial({
			side:        THREE.DoubleSide,
			color:       0x229944,
			transparent: true,
			alphaTest:   0.1,
			shadowSide:  THREE.FrontSide,
		});

		this.setupGrassMaterial(this.material);
	}

	update(delta: number) {
		this.uniforms.uTime.value = delta;
	}

	setupTextures(grassAlphaTexture: THREE.Texture, noiseTexture: THREE.Texture) {
		this.uniforms.grassAlphaTexture.value = grassAlphaTexture;
		this.uniforms.noiseTexture.value      = noiseTexture;
	}

	private setupGrassMaterial(material: THREE.Material) {
		material.onBeforeCompile = (shader) => {
			shader.uniforms = {
				...shader.uniforms,
				uTime:                this.uniforms.uTime,
				uTipColor1:           this.uniforms.tipColor1,
				uTipColor2:           this.uniforms.tipColor2,
				uBaseColor:           this.uniforms.baseColor,
				uEnableShadows:       this.uniforms.uEnableShadows,
				uShadowDarkness:      this.uniforms.uShadowDarkness,
				uGrassLightIntensity: this.uniforms.uGrassLightIntensity,
				uNoiseScale:          this.uniforms.uNoiseScale,
				uNoiseTexture:        this.uniforms.noiseTexture,
				uGrassAlphaTexture:   this.uniforms.grassAlphaTexture,
			};

			shader.vertexShader = `
      #include <common>
      #include <fog_pars_vertex>
      #include <shadowmap_pars_vertex>
      uniform sampler2D uNoiseTexture;
      uniform float uNoiseScale;
      uniform float uTime;

      varying vec3 vColor;
      varying vec2 vGlobalUV;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec2 vWindColor;

      void main() {
        #include <color_vertex>
        #include <begin_vertex>
        #include <project_vertex>
        #include <fog_vertex>
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <worldpos_vertex>
        #include <shadowmap_vertex>

        vec2 uWindDirection = vec2(1.0, 1.0);
        float uWindAmp    = 0.25;
        float uWindFreq   = 50.;
        float uSpeed      = 1.0;
        float uNoiseFactor= 5.50;
        float uNoiseSpeed = 0.001;

        vec2 windDirection = normalize(uWindDirection);
        vec4 modelPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);

        float terrainSize = 100.;
        vGlobalUV = (terrainSize - vec2(modelPosition.xz)) / terrainSize;

        vec4 noise = texture2D(uNoiseTexture, vGlobalUV + uTime * uNoiseSpeed);

        float sinWave = sin(
          uWindFreq * dot(windDirection, vGlobalUV) +
          noise.g * uNoiseFactor +
          uTime * uSpeed
        ) * uWindAmp * (1. - uv.y);

        float xDisp = sinWave;
        float zDisp = sinWave;
        modelPosition.x += xDisp;
        modelPosition.z += zDisp;

        modelPosition.y += exp(texture2D(uNoiseTexture, vGlobalUV * uNoiseScale).r) * 0.5 * (1. - uv.y);

        vec4 viewPosition    = viewMatrix * modelPosition;
        gl_Position          = projectionMatrix * viewPosition;

        vUv          = vec2(uv.x, 1. - uv.y);
        vNormal      = normalize(normalMatrix * normal);
        vWindColor   = vec2(xDisp, zDisp);
        vViewPosition= mvPosition.xyz;
      }
      `;

			shader.fragmentShader = `
      #include <alphatest_pars_fragment>
      #include <fog_pars_fragment>
      #include <common>
      #include <packing>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>

      uniform float uTime;
      uniform vec3  uBaseColor;
      uniform vec3  uTipColor1;
      uniform vec3  uTipColor2;
      uniform sampler2D uGrassAlphaTexture;
      uniform sampler2D uNoiseTexture;
      uniform float uNoiseScale;
      uniform bool  uEnableShadows;
      uniform float uGrassLightIntensity;
      uniform float uShadowDarkness;

      varying vec2 vUv;
      varying vec2 vGlobalUV;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec2 vWindColor;

      void main() {
        vec4 grassAlpha     = texture2D(uGrassAlphaTexture, vUv);
        vec4 grassVariation = texture2D(uNoiseTexture, vGlobalUV * uNoiseScale);
        vec3 tipColor       = mix(uTipColor1, uTipColor2, grassVariation.r);

        // diffuseColor must be declared for #include <alphatest_fragment>
        vec4 diffuseColor   = vec4(mix(uBaseColor, tipColor, vUv.y), step(0.1, grassAlpha.r));
        vec3 grassFinalColor= diffuseColor.rgb * uGrassLightIntensity;

        vec3 geometryNormal  = vNormal;
        vec3 geometryViewDir = (isOrthographic) ? vec3(0,0,1) : normalize(vViewPosition);

        float shadow = 1.0;
        if (uEnableShadows) {
          #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
            IncidentLight directLight;
            DirectionalLight directionalLight;
            DirectionalLightShadow directionalLightShadow;
            float currentShadow = 1.0;
            float weight = 0.0;
            #pragma unroll_loop_start
            for (int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i++) {
              directionalLight       = directionalLights[i];
              getDirectionalLightInfo(directionalLight, directLight);
              directionalLightShadow = directionalLightShadows[i];
              currentShadow = getShadow(
                directionalShadowMap[i],
                directionalLightShadow.shadowMapSize,
                directionalLightShadow.shadowIntensity,
                directionalLightShadow.shadowBias,
                directionalLightShadow.shadowRadius,
                vDirectionalShadowCoord[i]
              );
              currentShadow = all(bvec2(directLight.visible, receiveShadow)) ? currentShadow : 1.0;
              weight  = clamp(pow(length(vDirectionalShadowCoord[i].xy * 2. - 1.), 4.), 0.0, 1.0);
              shadow  = mix(currentShadow, 1.0, weight);
            }
            #pragma unroll_loop_end
            grassFinalColor = mix(grassFinalColor, grassFinalColor * uShadowDarkness, 1.0 - shadow);
          #endif
        }

        diffuseColor.rgb = clamp(diffuseColor.rgb * shadow, 0.0, 1.0);

        #include <alphatest_fragment>
        gl_FragColor = vec4(grassFinalColor, 1.0);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
      `;
		};
	}
}
