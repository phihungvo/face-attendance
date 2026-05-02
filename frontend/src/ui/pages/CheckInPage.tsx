import { useMemo, useRef, useState } from "react";
import { api, ApiResponse, getApiErrorMessage } from "../apiClient";

type CheckinResponse = { user_name: string; confidence: number; time: string };

export default function CheckInPage() {
  const [mode, setMode] = useState<"upload" | "webcam">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const canWebcam = useMemo(() => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia, []);

  async function startWebcam() {
    if (!canWebcam) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  }

  function stopWebcam() {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function checkinWithBytes(imageBytes: Blob) {
    try {
      setBusy(true);
      setError(null);
      setResult(null);
      const form = new FormData();
      form.append("image", imageBytes, "checkin.jpg");
      const res = await api.post<ApiResponse<CheckinResponse>>("/attendance/checkin", form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setResult(res.data.result ?? null);
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function checkinUpload() {
    if (!file) {
      setError("Vui lòng chọn ảnh trước");
      return;
    }
    await checkinWithBytes(file);
  }

  async function checkinWebcam() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setError("Không thể chụp ảnh từ webcam");
      return;
    }
    await checkinWithBytes(blob);
  }

  return (
    <div className="page">
      <h1>Check-in</h1>
      {error ? <div className="alert error">{error}</div> : null}
      {result ? (
        <div className="alert ok">
          Khớp: <b>{result.user_name}</b> (độ tin cậy={result.confidence.toFixed(3)}) lúc{" "}
          {new Date(result.time).toLocaleString()}
        </div>
      ) : null}

      <div className="card">
        <div className="tabs">
          <button
            className={mode === "upload" ? "tab active" : "tab"}
            onClick={() => {
              stopWebcam();
              setMode("upload");
            }}
          >
            Upload
          </button>
          <button
            className={mode === "webcam" ? "tab active" : "tab"}
            onClick={async () => {
              setMode("webcam");
              await startWebcam();
            }}
            disabled={!canWebcam}
            title={!canWebcam ? "Trình duyệt không hỗ trợ webcam" : undefined}
          >
            Webcam
          </button>
        </div>

        {mode === "upload" ? (
          <>
            <div className="formRow">
              <label className="label">Image</label>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <button className="btn" onClick={checkinUpload} disabled={busy}>
              {busy ? "Đang kiểm tra..." : "Check-in"}
            </button>
          </>
        ) : (
          <>
            <div className="webcamWrap">
              <video ref={videoRef} className="webcam" playsInline />
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={checkinWebcam} disabled={busy}>
                {busy ? "Đang kiểm tra..." : "Chụp & Check-in"}
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  stopWebcam();
                  startWebcam().catch(() => null);
                }}
                disabled={busy}
              >
                Khởi động lại
              </button>
              <button className="btn secondary" onClick={stopWebcam} disabled={busy}>
                Dừng camera
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
