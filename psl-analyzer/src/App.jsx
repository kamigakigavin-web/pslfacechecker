import React, { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { Camera, Upload, ScanFace, ShieldCheck, RotateCcw, Sparkles } from "lucide-react";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

function clamp(n, min = 1, max = 10) { return Math.max(min, Math.min(max, n)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function average(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

// These are playful geometric proxies, not validated attractiveness measurements.
function analyze(landmarks) {
  const pairs = [[33,263],[133,362],[234,454],[127,356],[10,152],[61,291],[105,334],[159,386]];
  const symmetryErrors = pairs.map(([a,b]) => {
    const p = landmarks[a], q = landmarks[b];
    return Math.abs((p.x - .5) + (q.x - .5)) + Math.abs(p.y - q.y);
  });
  const symmetry = clamp(10 - average(symmetryErrors) * 13.5);

  const faceWidth = distance(landmarks[234], landmarks[454]);
  const faceHeight = distance(landmarks[10], landmarks[152]);
  const ratio = faceHeight / Math.max(faceWidth, .001);
  const proportions = clamp(10 - Math.abs(ratio - 1.32) * 5.5);

  const eyeMidY = (landmarks[159].y + landmarks[386].y) / 2;
  const noseY = landmarks[1].y;
  const mouthY = landmarks[13].y;
  const thirdsA = Math.abs((eyeMidY - landmarks[10].y) - (noseY - eyeMidY));
  const thirdsB = Math.abs((noseY - eyeMidY) - (mouthY - noseY));
  const thirds = clamp(10 - (thirdsA + thirdsB) * 22);

  const eyeDistance = distance(landmarks[33], landmarks[263]);
  const eyeSpacingRatio = eyeDistance / Math.max(faceWidth, .001);
  const eyeArea = clamp(10 - Math.abs(eyeSpacingRatio - .39) * 18);

  const jawWidth = distance(landmarks[172], landmarks[397]);
  const lowerFace = distance(landmarks[1], landmarks[152]);
  const jaw = clamp(5.5 + (jawWidth / Math.max(faceWidth, .001) - .43) * 10 + (lowerFace / Math.max(faceHeight,.001) - .42) * 3);

  const features = [
    { name: "Facial symmetry", score: symmetry, note: "Approximate left-right landmark balance" },
    { name: "Facial proportions", score: proportions, note: "A rough face-height to face-width ratio" },
    { name: "Facial thirds", score: thirds, note: "Approximate spacing between key landmarks" },
    { name: "Eye spacing", score: eyeArea, note: "A geometric estimate of eye placement" },
    { name: "Jaw structure", score: jaw, note: "A rough lower-face width estimate" }
  ];
  const overall = clamp(average(features.map(x => x.score)));
  return { overall, features };
}

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const [image, setImage] = useState(null);
  const [source, setSource] = useState("upload");
  const [status, setStatus] = useState("Choose a selfie or start your camera.");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => () => stopCamera(), []);

  async function getLandmarker() {
    if (landmarkerRef.current) return landmarkerRef.current;
    setStatus("Loading face landmark model…");
    const vision = await FilesetResolver.forVisionTasks(WASM);
    landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
      runningMode: "IMAGE",
      numFaces: 1
    });
    return landmarkerRef.current;
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function startCamera() {
    try {
      setSource("camera");
      setResult(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
      setStatus("Camera ready. Capture a photo when you're centered.");
    } catch (err) {
      setStatus("Camera access was blocked or unavailable. Try uploading a selfie instead.");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    setImage(canvas.toDataURL("image/jpeg", .92));
    stopCamera();
    setStatus("Photo captured. Ready to analyze.");
  }

  function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setStatus("Please choose an image file."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result);
      setResult(null);
      setSource("upload");
      setStatus("Selfie loaded. Ready to analyze.");
    };
    reader.readAsDataURL(file);
  }

  async function analyzeFace() {
    if (!image) return;
    setBusy(true);
    setResult(null);
    try {
      const detector = await getLandmarker();
      const img = new Image();
      img.src = image;
      await img.decode();
      const detection = detector.detect(img);
      if (!detection.faceLandmarks?.length) {
        setStatus("No face found. Try a clear, front-facing photo with even lighting.");
        return;
      }
      const report = analyze(detection.faceLandmarks[0]);
      setResult(report);
      setStatus("Analysis complete. This is a playful estimate, not an objective rating.");
    } catch (error) {
      console.error(error);
      setStatus("Couldn't analyze that image. Try another clear, front-facing selfie.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setImage(null); setResult(null); setStatus("Choose a selfie or start your camera."); stopCamera();
  }

  return <main className="shell">
    <nav className="nav">
      <div className="brand"><span className="brand-icon"><ScanFace size={19}/></span> PSL<span className="muted">/</span>ANALYZER</div>
      <div className="privacy"><ShieldCheck size={15}/> ON-DEVICE ANALYSIS</div>
    </nav>

    <section className="hero">
      <div className="eyebrow"><span className="pulse"/> FACIAL GEOMETRY LAB</div>
      <h1>See your face<br/><span>from a new angle.</span></h1>
      <p className="intro">A playful breakdown of facial landmarks, proportions and symmetry. No hype, no fake science.</p>
    </section>

    <section className="workspace">
      <div className="panel scan-panel">
        <div className="panel-head"><div><div className="step">01 / INPUT</div><h2>Your scan</h2></div><span className="live-dot">● READY</span></div>
        <div className="preview">
          {cameraOn ? <video ref={videoRef} playsInline muted className="media mirror"/> :
            image ? <img src={image} className="media" alt="Selected selfie"/> :
            <div className="placeholder"><div className="face-outline"><ScanFace size={54} strokeWidth={1}/></div><strong>Face preview</strong><span>Upload a selfie or use your camera</span></div>}
          <canvas ref={canvasRef} hidden/>
          {cameraOn && <div className="frame-overlay"><span/><span/><span/><span/></div>}
        </div>
        <div className="actions">
          <label className="button secondary"><Upload size={16}/> Upload selfie<input type="file" accept="image/*" onChange={upload} hidden/></label>
          {!cameraOn ? <button className="button secondary" onClick={startCamera}><Camera size={16}/> Use camera</button> :
            <button className="button secondary" onClick={capture}>Capture photo</button>}
        </div>
        {image && <button className="button primary analyze" disabled={busy} onClick={analyzeFace}><Sparkles size={17}/>{busy ? "Analyzing…" : "Analyze my face"}</button>}
        {cameraOn && <button className="text-button" onClick={stopCamera}>Turn camera off</button>}
        <p className="status">{status}</p>
      </div>

      <div className="panel results-panel">
        <div className="panel-head"><div><div className="step">02 / RESULTS</div><h2>Face report</h2></div><span className="report-tag">PERSONAL REPORT</span></div>
        {!result ? <div className="empty-results"><div className="orbit"><ScanFace size={30}/></div><h3>Your report appears here</h3><p>Run a scan to see your geometric feature breakdown.</p><div className="skeleton"><i/><i/><i/><i/></div></div> :
          <div className="report">
            <div className="score-wrap"><div className="score-ring"><strong>{result.overall.toFixed(1)}</strong><small>/ 10</small></div><div><div className="score-label">GEOMETRY INDEX</div><p>Playful estimate based on detected landmarks</p></div></div>
            <div className="feature-list">{result.features.map(item => <div className="feature" key={item.name}>
              <div className="feature-top"><strong>{item.name}</strong><b>{item.score.toFixed(1)}<small>/10</small></b></div>
              <div className="track"><span style={{width:`${item.score*10}%`}}/></div>
              <p>{item.note}</p>
            </div>)}</div>
            <button className="button secondary full" onClick={reset}><RotateCcw size={15}/> New scan</button>
          </div>}
      </div>
    </section>

    <section className="disclaimer"><ShieldCheck size={18}/><div><strong>Privacy first</strong><p>Your photo is processed in your browser. This starter app does not upload or save your image. The scores are experimental geometric proxies, not scientific attractiveness ratings or a substitute for human judgment.</p></div></section>
    <footer><span>PSL ANALYZER © 2026</span><span>BUILT FOR CURIOSITY, NOT COMPARISON.</span></footer>
  </main>;
}