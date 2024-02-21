for (let i = 0, element; (element = document.querySelectorAll('input[type="range"]')[i++]); ) {
	rangeSlider.create(element, {
		polyfill: true
	});
}

$(() => {
	$('.controls').hide();
	setTimeout(() => {
		$('.controls').show();
	}, 5000);
	let speedSlider = $('input[name="speed"]'),
		spikesSlider = $('input[name="spikes"]'),
		processingSlider = $('input[name="processing"]');

	let $canvas = $('canvas'),
		canvas = $canvas[0],
		renderer = new THREE.WebGLRenderer({
			canvas: canvas,
			context: canvas.getContext('webgl2'),
			antialias: true,
			alpha: true
		}),
		simplex = new SimplexNoise();

	renderer.setSize($canvas.width(), $canvas.height());
	renderer.setPixelRatio(window.devicePixelRatio || 1);

	let scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(45, $canvas.width() / $canvas.height(), 0.1, 1000);

	camera.position.z = 5;

	let geometry = new THREE.SphereGeometry(0.8, 128, 128);

	let material = new THREE.MeshPhongMaterial({
		color: 0x44ff44,
		shininess: 100
	});

	let lightTop = new THREE.DirectionalLight(0xaaffaa, 1);
	lightTop.position.set(0, 500, 200);
	lightTop.castShadow = true;
	scene.add(lightTop);

	let lightBottom = new THREE.DirectionalLight(0xaaffaa, 0.5);
	lightBottom.position.set(0, -500, 400);
	lightBottom.castShadow = true;
	scene.add(lightBottom);

	window.blob = new THREE.Mesh(geometry, material);

	scene.add(blob);

	class Globe {
		constructor() {
			this.r = 100;
			this.segment = 20;
			this.textureSrc;

			this.geometry;
			this.material;
			this.mesh;
		}

		init(scene) {
			this.geometry = new THREE.SphereGeometry(this.r, this.segment, this.segment);
			this.geometry.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
			this.material = new THREE.MeshBasicMaterial({
				wireframe: true,
				color: 0x00ff00
			});
			this.mesh = new THREE.Mesh(this.geometry, this.material);
			scene.add(this.mesh);
		}
	}

	let globe = new Globe();
	globe.init(scene);

	let rotation = 0;

	function animate() {
		let time = performance.now() * 0.00001 * speedSlider.val() * Math.pow(processingSlider.val(), 3),
			spikes = spikesSlider.val() * processingSlider.val();

		let p = blob.geometry.attributes.position;
		let pa = blob.geometry.attributes.position.array;
		for (let i = 0; i < blob.geometry.attributes.position.count; i++) {
			let v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
			v.normalize().multiplyScalar(1 + 0.3 * simplex.noise3D(v.x * spikes, v.y * spikes, v.z * spikes + time));
			pa[i * 3] = v.x;
			pa[i * 3 + 1] = v.y;
			pa[i * 3 + 2] = v.z;
		}

		geometry.attributes.position.needsUpdate = true;
		blob.geometry.normalsNeedUpdate = true;
		blob.geometry.computeVertexNormals();

		rotation += 0.005;
		camera.position.x = 5;
		camera.position.y = Math.sin(rotation) * 10;
		camera.position.z = Math.cos(rotation) * 10;
		camera.lookAt(scene.position); // the origin
		renderer.render(scene, camera);
		requestAnimationFrame(animate);
	}

	requestAnimationFrame(animate);
});
