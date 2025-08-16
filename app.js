// (same as your working version)
const warningEl = document.getElementById('webgl-warning');
const yearEl = document.getElementById('year'); if (yearEl) yearEl.textContent = new Date().getFullYear();
function showWarn(msg) { if (warningEl) { warningEl.textContent = msg; warningEl.hidden = false; } }
window.addEventListener('error', e => console.error('[Uncaught]', e.error || e.message));
window.addEventListener('unhandledrejection', e => console.error('[Promise]', e.reason));

try {
    if (!window.THREE) { showWarn('Three.js failed to load (network/CDN).'); throw new Error('THREE undefined'); }

    const canvas = document.createElement('canvas'); document.body.prepend(canvas);
    const attrs = { alpha: true, antialias: true, depth: true, stencil: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false };
    const gl = canvas.getContext('webgl2', attrs) || canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (!gl) { showWarn('WebGL truly unavailable in this browser session.'); throw new Error('No WebGL context'); }

    const clamp01 = v => Math.max(0, Math.min(1, v));
    const easeInOutCubic = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 50);
    camera.position.set(0.45, 1.1, 3.2);

    scene.add(new THREE.HemisphereLight(0x808080, 0x101010, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(2.2, 2.0, 2.5); scene.add(key);
    const warm = new THREE.DirectionalLight(0xDACE84, 1.1); warm.position.set(-1.6, 1.2, -1.5); scene.add(warm);
    const fill = new THREE.PointLight(0xDACE84, 0.7, 8); fill.position.set(0, 0.6, 0.8); scene.add(fill);

    function plane(x) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: 0x0D0D0D, transparent: true, opacity: .35 }));
        m.rotation.x = -Math.PI / 2; m.position.set(x, -0.33, -6); scene.add(m); return m;
    }
    const leftPlane = plane(-6), rightPlane = plane(6);

    const waferUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xBA9731) }, uGlow: { value: 0.35 } };
    const waferMat = new THREE.ShaderMaterial({
        uniforms: waferUniforms, transparent: true, depthWrite: false,
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uGlow; varying vec2 vUv;
      float ring(vec2 uv,float w){ float r=length(uv-.5); float b=abs(sin((r*32.)-uTime*.4)); return smoothstep(.5,.5-w,b); }
      void main(){ vec3 base=vec3(.06); float g=ring(vUv,.1); vec3 col=base+(uColor/255.)*g*uGlow; gl_FragColor=vec4(col,.55); }`
    });
    const wafer = new THREE.Mesh(new THREE.CircleGeometry(4.2, 96), waferMat);
    wafer.rotation.x = -Math.PI / 2; wafer.position.y = -0.33; scene.add(wafer);

    const chip = new THREE.Group(); scene.add(chip);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, .26, 1.7),
        new THREE.MeshPhysicalMaterial({ color: 0x111111, metalness: .95, roughness: .22, clearcoat: 1, clearcoatRoughness: .35, emissive: 0x4f3e12, emissiveIntensity: .25 })
    ); body.castShadow = body.receiveShadow = true; chip.add(body);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.52, .003, 1.52), new THREE.MeshPhysicalMaterial({ color: 0x0f0f0f, metalness: .6, roughness: .55 }));
    pad.position.y = .135; chip.add(pad);

    // Create canvas for AI text
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 256;
    textCanvas.height = 128;
    const context = textCanvas.getContext('2d');
    context.fillStyle = '#000000';
    context.fillRect(0, 0, textCanvas.width, textCanvas.height);
    context.font = 'bold 80px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Create gradient for text
    const gradient = context.createLinearGradient(0, 0, textCanvas.width, 0);
    gradient.addColorStop(0, '#BA9731');
    gradient.addColorStop(0.5, '#DACE84');
    gradient.addColorStop(1, '#BA9731');
    context.fillStyle = gradient;

    // Draw text with glow effect
    context.shadowColor = '#BA9731';
    context.shadowBlur = 20;
    context.fillText('AI', textCanvas.width / 2, textCanvas.height / 2);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(textCanvas);
    const aiTextMaterial = new THREE.MeshPhysicalMaterial({
        map: texture,
        emissive: 0xBA9731,
        emissiveMap: texture,
        emissiveIntensity: 1,
        transparent: true,
        opacity: 1
    });

    const aiTextGeometry = new THREE.PlaneGeometry(0.8, 0.4);
    const aiTextMesh = new THREE.Mesh(aiTextGeometry, aiTextMaterial);
    aiTextMesh.position.set(0, 0.137, 0); // Just above the pad
    aiTextMesh.rotation.x = -Math.PI / 2; // Rotate to lay flat on chip
    chip.add(aiTextMesh); const pinCount = 64;
    const pinGeo = new THREE.BoxGeometry(.06, .06, .18);
    const pinMat = new THREE.MeshPhysicalMaterial({ color: 0xBA9731, emissive: 0x6b5318, emissiveIntensity: 1.2, metalness: 1, roughness: .12, reflectivity: 1 });
    const pins = new THREE.InstancedMesh(pinGeo, pinMat, pinCount); pins.castShadow = pins.receiveShadow = true; chip.add(pins);

    (function setPins() {
        const S = 1.7, perSide = pinCount / 4, gap = S / (perSide + 1), L = .18;
        for (let i = 0; i < pinCount; i++) {
            const side = Math.floor(i / perSide), idx = i % perSide;
            const m = new THREE.Matrix4(), pos = new THREE.Vector3(), rot = new THREE.Euler();
            const off = -S / 2 + gap * (idx + 1);
            if (side === 0) { pos.set(off, -.15, S / 2 + L / 2); rot.set(-Math.PI / 2.5, 0, 0); }
            else if (side === 1) { pos.set(S / 2 + L / 2, -.15, -off); rot.set(0, Math.PI / 2.5, 0); }
            else if (side === 2) { pos.set(-off, -.15, -S / 2 - L / 2); rot.set(Math.PI / 2.5, 0, 0); }
            else { pos.set(-S / 2 - L / 2, -.15, off); rot.set(0, -Math.PI / 2.5, 0); }
            m.compose(pos, new THREE.Quaternion().setFromEuler(rot), new THREE.Vector3(1, 1, 1));
            pins.setMatrixAt(i, m);
        }
        pins.instanceMatrix.needsUpdate = true;
    })();

    let composer = null;
    try {
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        if (THREE.UnrealBloomPass) {
            const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.1, 0.6, 0.18);
            composer.addPass(bloom);
        }
    } catch (e) { console.warn('[Postprocessing disabled]', e); }

    let progress = 0, total = 1;
    function recalc() { total = Math.max(1, document.body.scrollHeight - window.innerHeight); }
    function onScroll() { progress = clamp01((window.scrollY || window.pageYOffset) / total); }
    recalc(); onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

    const clock = new THREE.Clock();
    function frame() {
        requestAnimationFrame(frame);
        const t = clock.getElapsedTime();

        // Update AI text glow
        if (aiTextMesh && aiTextMesh.material) {
            aiTextMesh.material.emissiveIntensity = 1.5 + Math.sin(t * 2) * 0.5;
            aiTextMesh.material.opacity = 0.8 + Math.sin(t * 2) * 0.2;
        }

        waferUniforms.uTime.value = t;
        wafer.rotation.z = t * 0.08 + progress * 0.6;

        const p = easeInOutCubic(progress);
        chip.rotation.x = 0.28 + p * 1.35;
        chip.rotation.y = -0.25 + p * 1.95;
        chip.position.y = (0.5 - p) * 0.6;
        chip.position.z = -0.25 + p * 0.95;

        const orbit = 0.15 * Math.sin(t * 0.5);
        camera.position.x = Math.sin(p * Math.PI * 0.85 + orbit) * 0.95;
        camera.position.z = 3.0 - p * 1.25;
        camera.position.y = 1.05 + Math.sin(t * 0.35) * 0.03;
        camera.lookAt(0, 0, 0);

        if (composer) composer.render(); else renderer.render(scene, camera);
    }
    frame();

    window.addEventListener('resize', () => {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
        if (composer) composer.setSize(window.innerWidth, window.innerHeight);
        recalc(); onScroll();
    }, { passive: true });

} catch (e) {
    console.error('[Init failed]', e);
    showWarn('3D initialization failed. Open DevTools → Console and share the first red error.');
}
