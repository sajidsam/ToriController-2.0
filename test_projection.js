const THREE = require('three');

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
camera.position.set(-120, 80, -120);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();

const euler = new THREE.Euler(-(-1.2) * Math.PI/180, -(81) * Math.PI/180, (-27.7) * Math.PI/180, 'YXZ');
const sub = new THREE.Object3D();
sub.rotation.copy(euler);
sub.updateMatrixWorld();

const nose = new THREE.Vector3(0, 0, 1).applyMatrix4(sub.matrixWorld);
const up = new THREE.Vector3(0, 1, 0).applyMatrix4(sub.matrixWorld);
const right = new THREE.Vector3(-1, 0, 0).applyMatrix4(sub.matrixWorld);

nose.project(camera);
up.project(camera);
right.project(camera);

console.log("Nose projected:", nose.x, nose.y);
console.log("Up projected:", up.x, up.y);
console.log("Right projected:", right.x, right.y);
