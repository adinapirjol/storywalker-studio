/* global importScripts */
// Both detectors run locally, sequentially, on one frame. No frame queue or external URLs.
self.exports = {};
importScripts('/vendor/head-tracking/vision.js');
let faceDetector, handDetector;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      const wasm = {
        wasmLoaderPath: '/vendor/head-tracking/vision_wasm_nosimd_internal.js',
        wasmBinaryPath: '/vendor/head-tracking/vision_wasm_nosimd_internal.wasm',
      };
      faceDetector = await self.exports.FaceDetector.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: '/vendor/head-tracking/face.tflite', delegate: 'CPU' },
        runningMode: 'VIDEO', minDetectionConfidence: .65,
      });
      handDetector = await self.exports.HandLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: '/vendor/head-tracking/hand_landmarker.task', delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: .65, minHandPresenceConfidence: .65,
      });
      self.postMessage({ type: 'ready' });
    } catch { self.postMessage({ type: 'error' }); }
    return;
  }
  if (data.type !== 'frame') return;
  try {
    const faces = faceDetector.detectForVideo(data.bitmap, data.time).detections;
    const box = faces.length === 1 ? faces[0].boundingBox : null;
    const result = handDetector.detectForVideo(data.bitmap, data.time);
    const landmarks = result.landmarks.slice(0, 2).map(points => points.map(({ x, y }) => ({ x, y })));
    self.postMessage({ type: 'position', landmarks, face: box ? {
      x: (box.originX + box.width / 2) / data.bitmap.width,
      y: (box.originY + box.height / 2) / data.bitmap.height,
    } : null });
  } catch { self.postMessage({ type: 'error' }); }
  finally { data.bitmap.close(); }
};
