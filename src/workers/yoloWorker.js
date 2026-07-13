import * as ort from "onnxruntime-web";
import { detectObjects } from "../utils/yoloUtils";

let session = null;

async function initModel() {
  try {
    ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
    session = await ort.InferenceSession.create("/YOLOv26s.onnx", {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    postMessage({ type: "ready" });
  } catch (e) {
    console.error("Worker Model Load Error:", e);
    postMessage({ type: "error", message: e.message });
  }
}

initModel();

self.onmessage = async (e) => {
  const { type, pixels, width, height } = e.data;
  
  if (type === "detect") {
    if (!session) {
      postMessage({ type: "result", boxes: [] });
      return;
    }
    try {
      // Run detection, detectObjects takes the raw pixels array
      const boxes = await detectObjects(session, pixels, 0.4);
      
      // Send the unscaled boxes back to the main thread
      postMessage({ type: "result", boxes, width, height });
    } catch (e) {
      postMessage({ type: "error", message: e.message });
    }
  }
};
