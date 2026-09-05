import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { detectFormatFromFilename } from "../api";

interface UploadPanelProps {
  onUpload: (file: File, title?: string) => Promise<void>;
  busy: boolean;
  error: string | null;
}

export function UploadPanel({ onUpload, busy, error }: UploadPanelProps) {
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (!detectFormatFromFilename(file.name)) {
      setPendingFile(null);
      return;
    }
    setPendingFile(file);
  }

  return (
    <section className="card">
      <h2>
        <Icon icon="solar:upload-bold" className="icon" width={16} />
        Upload script
      </h2>
      <div
        className={`dropzone${dragOver ? " dropzone-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.fountain,.fdx,.pdf"
          hidden
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <Icon icon="solar:file-text-bold-duotone" className="dropzone-icon" width={32} height={32} />
        {pendingFile ? (
          <p className="mono">{pendingFile.name}</p>
        ) : (
          <p className="muted">
            Drag &amp; drop a <code>.fountain</code>, <code>.txt</code>, <code>.fdx</code>, or{" "}
            <code>.pdf</code> script here, or click to browse.
          </p>
        )}
      </div>
      {error && (
        <p className="bad">
          <Icon icon="solar:danger-circle-bold" className="icon" width={14} /> {error}
        </p>
      )}
      <button
        className="btn btn-primary"
        disabled={!pendingFile || busy}
        onClick={() => pendingFile && onUpload(pendingFile)}
      >
        {busy ? "Uploading…" : "Upload & parse"}
      </button>
    </section>
  );
}
