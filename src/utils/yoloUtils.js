import * as ort from 'onnxruntime-web';
import { yoloClasses } from './yoloClasses';

/**
 * Runs YOLO object detection using the provided ONNX session and raw pixel data (640x640 RGBA).
 */
export async function detectObjects(session, data, minScore = 0.4) {
  
  const float32Data = new Float32Array(640 * 640 * 3);
  
  let p = 0;
  for (let i = 0; i < data.length; i += 4) {
    float32Data[p] = data[i] / 255.0; // Red
    float32Data[p + 409600] = data[i + 1] / 255.0; // Green
    float32Data[p + 819200] = data[i + 2] / 255.0; // Blue
    p++;
  }
  
  // Create Tensor
  const tensor = new ort.Tensor("float32", float32Data, [1, 3, 640, 640]);
  
  // Run Inference
  // Note: first input is usually named "images"
  const inputName = session.inputNames[0];
  const feeds = { [inputName]: tensor };
  const results = await session.run(feeds);
  
  const outputName = session.outputNames[0];
  const outputTensor = results[outputName];
  const output = outputTensor.data; 
  const dims = outputTensor.dims;
  
  const boxes = [];
  
  // Handle YOLOv10/26 NMS-free shape: [1, 300, 6]
  if (dims.length === 3 && dims[2] === 6) {
    const numBoxes = dims[1];
    for (let i = 0; i < numBoxes; i++) {
      const offset = i * 6;
      const x1 = output[offset + 0];
      const y1 = output[offset + 1];
      const x2 = output[offset + 2];
      const y2 = output[offset + 3];
      const score = output[offset + 4];
      const classIdx = Math.round(output[offset + 5]);
      
      if (score >= minScore) {
        boxes.push({
          box: [x1, y1, x2 - x1, y2 - y1],
          score: score,
          classIdx: classIdx,
          className: yoloClasses[classIdx] || `Unknown-${classIdx}`
        });
      }
    }
  } 
  // Handle standard YOLOv8 shape: [1, 84, 8400]
  else if (dims.length === 3 && dims[1] === 84 && dims[2] === 8400) {
    const tempBoxes = [];
    for (let col = 0; col < 8400; col++) {
      let maxProb = 0;
      let maxClass = -1;
      for (let row = 4; row < 84; row++) {
        const prob = output[row * 8400 + col];
        if (prob > maxProb) {
          maxProb = prob;
          maxClass = row - 4;
        }
      }
      
      if (maxProb >= minScore) {
        const xc = output[0 * 8400 + col];
        const yc = output[1 * 8400 + col];
        const w = output[2 * 8400 + col];
        const h = output[3 * 8400 + col];
        
        const x1 = xc - w / 2;
        const y1 = yc - h / 2;
        tempBoxes.push({
          box: [x1, y1, w, h], 
          score: maxProb,
          classIdx: maxClass,
          className: yoloClasses[maxClass] || `Unknown-${maxClass}`
        });
      }
    }
    
    // Perform NMS for YOLOv8
    const iouThreshold = 0.45;
    tempBoxes.sort((a, b) => b.score - a.score);
    
    while (tempBoxes.length > 0) {
      const current = tempBoxes.shift();
      boxes.push(current);
      
      for (let i = tempBoxes.length - 1; i >= 0; i--) {
        if (tempBoxes[i].classIdx === current.classIdx) {
          const iou = calculateIoU(current.box, tempBoxes[i].box);
          if (iou > iouThreshold) {
            tempBoxes.splice(i, 1);
          }
        }
      }
    }
  }
  
  return boxes;
}

function calculateIoU(boxA, boxB) {
  const xA = Math.max(boxA[0], boxB[0]);
  const yA = Math.max(boxA[1], boxB[1]);
  const xB = Math.min(boxA[0] + boxA[2], boxB[0] + boxB[2]);
  const yB = Math.min(boxA[1] + boxA[3], boxB[1] + boxB[3]);
  
  const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  if (interArea === 0) return 0;
  
  const boxAArea = boxA[2] * boxA[3];
  const boxBArea = boxB[2] * boxB[3];
  
  return interArea / (boxAArea + boxBArea - interArea);
}
