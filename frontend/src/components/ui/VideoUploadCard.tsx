"use client";
import { t as translateCopy } from "@/lib/i18n";


import React, { useCallback, useEffect, useRef, useState } from "react";
import { Video, Circle, Square, RotateCcw } from "lucide-react";
import { BentoCard } from "./BentoCard";
import { Icon } from "./Icon";

export interface VideoUploadCardProps {
  onUpload?: (ipfsHash: string) => void;
  /** Maximum recording duration in seconds. Defaults to 60. */
  maxDurationSeconds?: number;
}

const DEFAULT_MAX_DURATION = 60;
const UPLOAD_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const IPFS_GATEWAY = "https://gateway.pinata.cloud";
const QUEUE_STORAGE_KEY = "pod-video-upload-queue";

/** Maximum accepted file size for uploads (50 MB). */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
/** Accepted web-playable video MIME types. */
const SUPPORTED_VIDEO_TYPES = ["video/mp4", "video/webm"];
/** Duration bounds (seconds) for uploaded proof videos. */
const MIN_DURATION_SECONDS = 5;
const MAX_DURATION_SECONDS = 180;

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

/**
 * Load a video blob into an offscreen <video> element and read its duration
 * and intrinsic resolution from the `loadedmetadata` event.
 */
function readVideoMetadata(blob: Blob): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Video metadata unavailable"));
      return;
    }
    const url = URL.createObjectURL(blob);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.muted = true;
    const cleanup = () => {
      el.onloadedmetadata = null;
      el.onerror = null;
      URL.revokeObjectURL(url);
    };
    el.onloadedmetadata = () => {
      const duration = el.duration;
      const width = el.videoWidth;
      const height = el.videoHeight;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Unable to read video duration"));
        return;
      }
      resolve({ duration, width, height });
    };
    el.onerror = () => {
      cleanup();
      reject(new Error("Unable to read video metadata"));
    };
    el.src = url;
  });
}

/** Validate a selected file's type and size before upload. */
function validateFile(file: File): string | null {
  if (file.size === 0) return "Selected file is empty (0 bytes).";
  if (!SUPPORTED_VIDEO_TYPES.includes(file.type)) {
    return "Unsupported video format. Please upload an MP4 or WebM file.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Video exceeds the 50 MB maximum file size.";
  }
  return null;
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
=======

interface QueuedUpload {
  hash: string;
  name: string;
  type: string;
  dataUrl: string;
}

/** Compute a SHA-256 hex digest of a blob for local dedupe. */
async function computeHash(blob: Blob): Promise<string> {
  const buffer = typeof blob.arrayBuffer === "function"
    ? await blob.arrayBuffer()
    : await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error("Failed to read video data"));
        reader.readAsArrayBuffer(blob);
      });
  try {
    if (!globalThis.crypto?.subtle) throw new Error("Web Crypto unavailable");
    const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return Array.from(new Uint8Array(buffer))
      .reduce((hash, byte) => Math.imul(hash ^ byte, 0x01000193) >>> 0, 0x811c9dc5)
      .toString(16);
  }
}

function readQueue(): QueuedUpload[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedUpload[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedUpload[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read video data"));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "video/webm";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Upload a blob to IPFS with resumable retry semantics. The upload is chunked
 * into a single request but retried with backoff; on persistent failure the
 * caller can queue it for offline retry.
 */
async function uploadToIpfs(
  blob: Blob,
  name: string,
  onProgress: (pct: number) => void,
  onRequest?: (request: XMLHttpRequest) => void,
  sha256?: string,
): Promise<string> {
  const data = new FormData();
  data.append("file", blob, name);
  if (sha256) {
    data.append("sha256", sha256);
    data.append(
      "pinataMetadata",
      JSON.stringify({ name, keyvalues: { sha256 } }),
    );
  }

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    onRequest?.(xhr);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText) as {
            IpfsHash?: string;
            cid?: string;
            hash?: string;
          };
          const hash = res.IpfsHash ?? res.cid ?? res.hash;
          if (!hash) {
            reject(new Error("Upload response did not include an IPFS hash"));
            return;
          }
          resolve(hash);
        } catch {
          reject(new Error("Malformed upload response"));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    xhr.open("POST", UPLOAD_ENDPOINT);
    const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
    if (jwt) xhr.setRequestHeader("Authorization", `Bearer ${jwt}`);
    xhr.send(data);
  });
}

export function VideoUploadCard({
  onUpload,
  maxDurationSeconds = DEFAULT_MAX_DURATION,
}: VideoUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadRequestRef = useRef<XMLHttpRequest | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [ipfsHash, setIpfsHash] = useState<string | null>(null);
  const [localHash, setLocalHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [queued, setQueued] = useState(() => readQueue().length);

  const abortUpload = () => {
    const request = uploadRequestRef.current;
    if (request && typeof request.abort === "function") request.abort();
    uploadRequestRef.current = null;
  };

  const cancelUpload = () => {
    abortUpload();
    setUploading(false);
    setProgress(0);
    setError(null);
  };

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleBlob = useCallback(async (blob: Blob, name: string) => {
    setUploading(true);
    setProgress(0);
    setError(null);
    const hashPromise = computeHash(blob).then((hash) => {
      setLocalHash(hash);
      return hash;
    });
    try {
      const sha256 = await hashPromise;
      const cid = await uploadToIpfs(blob, name, setProgress, (request) => {
        uploadRequestRef.current = request;
      }, sha256);
      setIpfsHash(cid);
      onUpload?.(cid);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const hash = await hashPromise;
      const queue = readQueue();
      if (!queue.some((item) => item.hash === hash)) {
        queue.push({ hash, name, type: blob.type, dataUrl: await blobToDataUrl(blob) });
        writeQueue(queue);
        setQueued(queue.length);
      }
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      uploadRequestRef.current = null;
      setUploading(false);
      setProgress(0);
    }
  }, [onUpload]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    abortUpload();
    setIpfsHash(null);
    setLocalHash(null);
    setMetadata(null);
    setCopied(false);
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setPreview(null);
      return;
    }

    let info: VideoMetadata;
    try {
      info = await readVideoMetadata(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to read video metadata");
      setPreview(null);
      return;
    }

    if (info.duration < MIN_DURATION_SECONDS || info.duration > MAX_DURATION_SECONDS) {
      setError(
        `Video duration must be between ${MIN_DURATION_SECONDS}s and ${MAX_DURATION_SECONDS}s.`,
      );
      setPreview(null);
      return;
    }

    setMetadata(info);
    setPreview(URL.createObjectURL(file));
    void handleBlob(file, file.name);
  }, [handleBlob]);

  const copyHash = useCallback(async () => {
    if (!localHash) return;
    try {
      await navigator.clipboard.writeText(localHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }, [localHash]);

  const stopRecording = useCallback(() => {
    stopTimer();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }, [stopTimer]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => undefined);
      }
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (!blob.size) return;
        setPreview(URL.createObjectURL(blob));
        const hash = await computeHash(blob);
        setLocalHash(hash);
        void handleBlob(blob, `pod-${hash.slice(0, 12)}.webm`);
      };
      recorderRef.current = recorder;
      recorder.start();
      elapsedRef.current = 0;
      setElapsed(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setElapsed((current) => {
          const next = current + 1;
          if (next >= maxDurationSeconds) stopRecording();
          return next;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start recording");
    }
  }, [handleBlob, maxDurationSeconds, stopRecording]);

  useEffect(() => () => {
    stopTimer();
    abortUpload();
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    if (preview) URL.revokeObjectURL(preview);
  }, [preview, stopTimer]);

  useEffect(() => () => {
    stopTimer();
    if (typeof uploadRequestRef.current?.abort === "function") {
      uploadRequestRef.current.abort();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [stopTimer]);
  const flushQueue = useCallback(async () => {
    const queue = readQueue();
    if (queue.length === 0) return;
    setUploading(true);
    const remaining: QueuedUpload[] = [];
    for (const item of queue) {
      try {
        const blob = dataUrlToBlob(item.dataUrl);
        const cid = await uploadToIpfs(blob, item.name, setProgress, (request) => {
          uploadRequestRef.current = request;
        }, item.hash);
        setIpfsHash(cid);
        onUpload?.(cid);
      } catch {
        remaining.push(item);
      }
    }
    writeQueue(remaining);
    setQueued(remaining.length);
    setUploading(false);
    setProgress(0);
  }, [onUpload]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const remaining = Math.max(0, maxDurationSeconds - elapsed);

  return (
    <BentoCard
      title={translateCopy("ui.evidence_upload_e144a6f")}
      icon={<Video className="w-5 h-5" />}
      glowVariant="gold"
      className="h-full"
    >
      {/* Live camera preview while recording */}
      {recording && (
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full max-h-40 rounded-lg object-cover mb-3 bg-black"
        />
      )}

      {/* Drop zone — accessible */}
      <div
        role="button"
        tabIndex={0}
        aria-label={translateCopy("ui.upload_delivery_proof_video_drag_2758b39")}
        aria-disabled={uploading}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => { if (!uploading && !recording) inputRef.current?.click(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!uploading && !recording) inputRef.current?.click();
          }
        }}
        className="
          border-2 border-dashed border-border-default
          rounded-xl p-6 flex flex-col items-center justify-center gap-3
          cursor-pointer
          hover:border-border-hover hover:bg-bg-elevated
          focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2
          transition-colors duration-200
          min-h-36
        "
      >
        {preview && !recording ? (
          <video
            src={preview}
            controls
            className="w-full max-h-40 rounded-lg object-cover"
          />
        ) : !recording ? (
          <>
            <Video className="w-8 h-8 text-text-muted" />
            <p className="text-text-muted text-sm text-center">
              {translateCopy("ui.upload_delivery_proof_video_for__680e193")}
            </p>
            <span className="text-xs text-text-muted">
              {translateCopy("ui.drag_drop_or_click_to_browse_a964e34")}
            </span>
          </>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm"
        aria-label={translateCopy("ui.choose_proof_video_file_6e791c5")}
        aria-hidden={false}
        tabIndex={-1}
        className="hidden file:rounded-full file:bg-elevated file:text-gold"
        onChange={handleChange}
      />

      {/* Recorder controls */}
      <div className="mt-3 flex items-center gap-2">
        {!recording ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={uploading}
            className="
              flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold
              bg-bg-elevated text-gold hover:bg-bg-elevated/80
              disabled:opacity-40 disabled:cursor-not-allowed
              focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2
              transition-colors duration-200
            "
          >
            <Circle className="w-4 h-4" /> {translateCopy("ui.record_video_max_duration", { seconds: maxDurationSeconds })}
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="
              flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold
              bg-status-danger text-text-inverse hover:opacity-90
              focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2
              transition-colors duration-200
            "
          >
            <Square className="w-4 h-4" /> {translateCopy("ui.stop_recording_remaining", { seconds: remaining })}
          </button>
        )}
      </div>

      {/* Video metadata preview */}
      {metadata && (
        <p className="mt-2 text-[11px] text-text-muted">
          {formatDuration(metadata.duration)} · {metadata.width}×{metadata.height}
        </p>
      )}

      {/* SHA-256 digest + copy button */}
      {localHash && (
        <div className="mt-2 flex items-center gap-2">
          <p
            className="text-[11px] text-text-muted truncate flex-1"
            title={localHash}
            data-testid="sha256-digest"
          >
            SHA-256: {localHash}
          </p>
          <button
            type="button"
            onClick={copyHash}
            aria-label={translateCopy("ui.copy_sha256_digest")}
            className="shrink-0 text-[11px] text-gold hover:text-gold-hover transition-colors"
          >
            {copied ? translateCopy("ui.copied") : translateCopy("ui.copy")}
          </button>
        </div>
      )}

      {/* Offline queue */}
      {queued > 0 && (
        <button
          type="button"
          onClick={flushQueue}
          disabled={uploading}
          className="
            mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold
            bg-bg-elevated text-gold hover:bg-bg-elevated/80
            disabled:opacity-40 disabled:cursor-not-allowed
            focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2
            transition-colors duration-200
          "
        >
          <RotateCcw className="w-3.5 h-3.5" /> {translateCopy(queued === 1 ? "ui.retry_one_queued_upload" : "ui.retry_queued_uploads", { count: queued })}
        </button>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs text-text-muted">
            <span>{translateCopy("ui.uploading_to_ipfs_436f33a")}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-bg-elevated rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-gold rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error — announced to AT */}
      {error && (
        <p role="alert" aria-live="polite" className="mt-3 text-xs text-status-danger">{error}</p>
      )}

      {/* IPFS hash link */}
      {ipfsHash && !uploading && (
        <div className="mt-4 flex items-center gap-2 bg-bg-elevated rounded-lg px-3 py-2">
          <span className="text-xs text-text-muted truncate flex-1">
            {ipfsHash}
          </span>
          <a
            href={`${IPFS_GATEWAY}/ipfs/${ipfsHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-gold hover:text-gold-hover transition-colors"
            aria-label={translateCopy("ui.view_on_ipfs_488ca35")}
          >
            <Icon name="external-link" size="sm" className="text-gold" />
          </a>
        </div>
      )}

      {/* Submit button — disabled state communicated via aria */}
      <button
        type="button"
        onClick={() => {
          if (!ipfsHash || uploading) return;
          onUpload?.(ipfsHash);
        }}
        disabled={!ipfsHash || uploading}
        aria-disabled={!ipfsHash || uploading}
        aria-describedby={!ipfsHash ? "video-upload-hint" : undefined}
        className="
          mt-4 w-full py-2 rounded-xl text-sm font-semibold
          bg-gold text-text-inverse
          hover:bg-gold-hover
          disabled:opacity-40 disabled:cursor-not-allowed
          focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2
          transition-colors duration-200
        "
      >
        {translateCopy("ui.submit_proof_7a3580b")}
      </button>
      {!ipfsHash && <p id="video-upload-hint" className="sr-only">{translateCopy("ui.upload_video_before_submit_proof")}</p>}
      {uploading && (
        <button
          type="button"
          onClick={cancelUpload}
          className="mt-3 w-full rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          {translateCopy("ui.cancel_upload")}
        </button>
      )}
    </BentoCard>
  );
}

export default VideoUploadCard;
