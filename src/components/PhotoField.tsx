import { useState } from "react";
import { CircleAlert, ImagePlus, LoaderCircle } from "lucide-react";
import { useApi } from "../helpers/api";
import { shrinkImage } from "../helpers/image";

// Goal photo picker for the goal dialog. Uploads as soon as a photo is chosen
// and puts the resulting URL in a hidden `image` input for the form to submit.
export default function PhotoField({
  initial,
  onBusyChange,
}: Readonly<{ initial?: string; onBusyChange: (busy: boolean) => void }>) {
  const api = useApi();
  const [url, setUrl] = useState(initial);
  const [localPreview, setLocalPreview] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const setUploading = (b: boolean) => {
    setBusy(b);
    onBusyChange(b);
  };

  const pick = async (file?: File) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file, like a JPG or PNG.");
      return;
    }
    let photo: Blob;
    try {
      photo = await shrinkImage(file);
    } catch {
      setError("This photo format can't be read here. Try a JPG or PNG.");
      return;
    }
    // Show the photo right away while it uploads.
    const local = URL.createObjectURL(photo);
    setLocalPreview(local);
    setUploading(true);
    try {
      const res = await api<{ url: string }>("/upload", {
        method: "POST",
        body: photo,
        headers: { "content-type": photo.type },
      });
      setUrl(res.url);
    } catch {
      setError("The photo didn't upload. Check your connection and try again.");
    } finally {
      setUploading(false);
      setLocalPreview(undefined);
      URL.revokeObjectURL(local);
    }
  };

  const src = localPreview ?? url;

  return (
    <div className="field">
      <span className="field-label" id="goal-photo-label">
        Photo
      </span>
      <input
        id="goal-photo"
        className="sr-only"
        type="file"
        accept="image/*"
        aria-labelledby="goal-photo-label"
        aria-describedby={error ? "goal-photo-error" : undefined}
        disabled={busy}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = ""; // so choosing the same file again still fires
        }}
      />
      <input type="hidden" name="image" value={url ?? ""} />

      <label
        htmlFor="goal-photo"
        className={`photo-drop${src ? " has-photo" : ""}${dragging ? " dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
      >
        {src ? (
          <img src={src} alt="" />
        ) : (
          <span className="photo-empty">
            <ImagePlus aria-hidden="true" size={26} />
            <span>Add a photo</span>
            <span className="photo-empty-hint">Click to choose, or drop one here</span>
          </span>
        )}
        {busy && (
          <span className="photo-busy" role="status">
            <LoaderCircle className="spin" aria-hidden="true" size={22} />
            Uploading…
          </span>
        )}
      </label>

      {src && !busy && (
        <div className="photo-actions">
          <label htmlFor="goal-photo" className="btn-secondary">
            Change photo
          </label>
          <button type="button" className="btn-secondary" onClick={() => setUrl(undefined)}>
            Remove
          </button>
        </div>
      )}

      {error && (
        <p id="goal-photo-error" className="field-error" role="alert">
          <CircleAlert aria-hidden="true" size={16} />
          {error}
        </p>
      )}
    </div>
  );
}
