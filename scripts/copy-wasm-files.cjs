const fs = require('fs-extra');
const path = require('path');

// Copy wasm-imagemagick files
const magickSourceDir = path.join(__dirname, '..', 'node_modules', 'wasm-imagemagick', 'dist');
const magickTargetDir = path.join(__dirname, '..', 'src', 'assets', 'wasm-imagemagick');

// Ensure target directory exists
fs.ensureDirSync(magickTargetDir);

// Copy all files
fs.copySync(magickSourceDir, magickTargetDir, { overwrite: true });
console.log('wasm-imagemagick files copied to assets directory');

// Copy our compiled WASM files
const wasmSourceDir = path.join(__dirname, '..', 'build');
const wasmTargetDir = path.join(__dirname, '..', 'src', 'assets', 'wasm');

// Ensure target directory exists
fs.ensureDirSync(wasmTargetDir);

// Copy and rename the debug version to grayscale.wasm
fs.copySync(
  path.join(wasmSourceDir, 'debug.wasm'),
  path.join(wasmTargetDir, 'grayscale.wasm'),
  { overwrite: true }
);

// Copy debug and release WASM files
const wasmFiles = ['debug.wasm', 'release.wasm'];

wasmFiles.forEach(file => {
  const sourceFile = path.join(wasmSourceDir, file);
  if (fs.existsSync(sourceFile)) {
    const targetFile = path.join(wasmTargetDir, 'grayscale.wasm');
    fs.copyFileSync(sourceFile, targetFile);
    console.log(`Copied ${file} to ${targetFile}`);
  }
});

// Copy OpenCV.js files
const opencvSourceDir = path.join(__dirname, '..', 'node_modules', '@techstark', 'opencv-js', 'dist');
const opencvTargetDir = path.join(__dirname, '..', 'src', 'assets', 'opencv');

// Ensure target directory exists
fs.ensureDirSync(opencvTargetDir);

// Copy OpenCV.js files
const opencvFiles = ['opencv.js', 'opencv.js.patch'];

opencvFiles.forEach(file => {
  const sourceFile = path.join(opencvSourceDir, file);
  if (fs.existsSync(sourceFile)) {
    const targetFile = path.join(opencvTargetDir, file);
    fs.copyFileSync(sourceFile, targetFile);
    console.log(`Copied ${file} to ${targetFile}`);
  } else {
    console.warn(`Warning: ${sourceFile} not found`);
  }
});
