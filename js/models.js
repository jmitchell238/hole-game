// GLTF model preloader for KayKit City Builder Bits
// Loads models once at startup; builders in props.js use modelClone() with fallback

const MODELS = {};

const MODEL_DEFS = [
  // Cars (5)
  { key: 'car_sedan', url: 'art/models/citybits/car_sedan.gltf' },
  { key: 'car_taxi', url: 'art/models/citybits/car_taxi.gltf' },
  { key: 'car_police', url: 'art/models/citybits/car_police.gltf' },
  { key: 'car_hatchback', url: 'art/models/citybits/car_hatchback.gltf' },
  { key: 'car_stationwagon', url: 'art/models/citybits/car_stationwagon.gltf' },
  // Buildings (8)
  { key: 'building_A', url: 'art/models/citybits/building_A.gltf' },
  { key: 'building_B', url: 'art/models/citybits/building_B.gltf' },
  { key: 'building_C', url: 'art/models/citybits/building_C.gltf' },
  { key: 'building_D', url: 'art/models/citybits/building_D.gltf' },
  { key: 'building_E', url: 'art/models/citybits/building_E.gltf' },
  { key: 'building_F', url: 'art/models/citybits/building_F.gltf' },
  { key: 'building_G', url: 'art/models/citybits/building_G.gltf' },
  { key: 'building_H', url: 'art/models/citybits/building_H.gltf' },
  // Other city props (8)
  { key: 'bench', url: 'art/models/citybits/bench.gltf' },
  { key: 'bush', url: 'art/models/citybits/bush.gltf' },
  { key: 'firehydrant', url: 'art/models/citybits/firehydrant.gltf' },
  { key: 'streetlight', url: 'art/models/citybits/streetlight.gltf' },
  { key: 'trash_A', url: 'art/models/citybits/trash_A.gltf' },
  { key: 'trash_B', url: 'art/models/citybits/trash_B.gltf' },
  { key: 'dumpster', url: 'art/models/citybits/dumpster.gltf' },
  { key: 'watertower', url: 'art/models/citybits/watertower.gltf' },
];

// Preload all models: convert materials to Lambert for consistency
function preloadModels() {
  const loader = new THREE.GLTFLoader();

  MODEL_DEFS.forEach(def => {
    loader.load(def.url,
      gltf => {
        // Traverse and replace all MeshStandardMaterial with MeshLambertMaterial
        const scene = gltf.scene;
        scene.traverse(node => {
          if (node.isMesh) {
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            const newMaterials = materials.map(mat => {
              if (mat.isMeshStandardMaterial) {
                const newMat = new THREE.MeshLambertMaterial({
                  map: mat.map || null,
                  color: mat.color ? mat.color.clone() : 0xffffff,
                });
                if (newMat.map) {
                  newMat.map.encoding = THREE.sRGBEncoding;
                }
                return newMat;
              }
              return mat;
            });
            node.material = newMaterials.length === 1 ? newMaterials[0] : newMaterials;
          }
        });

        // Compute bounding box and store
        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        MODELS[def.key] = {
          proto: scene,
          size: { x: size.x, y: size.y, z: size.z }
        };
      },
      undefined,
      err => {
        console.warn(`Failed to load model ${def.key}:`, err.message || err);
      }
    );
  });
}

// Helper: clone a model and scale it uniformly to match targetLen on the given axis
// Special axis 'max_xz': scale to match max(x, z) for footprint-driven props
// Returns a cloned, scaled mesh with origin at ground level (bbox.min.y === 0)
// Returns null if the model hasn't loaded yet
function modelClone(key, targetLen, axis) {
  const modelData = MODELS[key];
  if (!modelData) return null;

  const clone = modelData.proto.clone();

  // Compute bbox of clone
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());

  // Get the size along the target axis
  let axisSize;
  if (axis === 'max_xz') {
    axisSize = Math.max(size.x, size.z);
  } else if (axis === 'x') {
    axisSize = size.x;
  } else if (axis === 'y') {
    axisSize = size.y;
  } else if (axis === 'z') {
    axisSize = size.z;
  } else {
    axisSize = 1;
  }

  // Compute uniform scale
  const scale = axisSize > 0 ? targetLen / axisSize : 1;
  clone.scale.multiplyScalar(scale);

  // Recompute bbox after scaling
  const scaledBox = new THREE.Box3().setFromObject(clone);

  // Ground the origin: translate so bbox.min.y === 0
  const minY = scaledBox.min.y;
  clone.position.y -= minY;

  return clone;
}

// Boot: preload all models at startup (long before first match)
preloadModels();
