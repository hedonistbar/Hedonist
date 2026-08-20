import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  BOARD_BACKGROUNDS,
  getBoardBackgroundImageUrl,
  uploadBoardBackgroundImage,
} from "../lib/backgrounds";

export function BackgroundModal({
  boardId,
  current,
  currentImagePath,
  onClose,
  onChanged,
}: {
  boardId: string;
  current: string | null;
  currentImagePath: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentImagePath) {
      setPreviewUrl(null);
      return;
    }
    getBoardBackgroundImageUrl(currentImagePath).then(setPreviewUrl);
  }, [currentImagePath]);

  async function pick(id: string) {
    await supabase
      .from("boards")
      .update({ background: id === "default" ? null : id, background_image_path: null })
      .eq("id", boardId);
    onChanged();
    onClose();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Выберите файл изображения.");
      return;
    }
    setUploading(true);
    setError(null);
    const oldPath = currentImagePath;
    const { path, error: uploadError } = await uploadBoardBackgroundImage(boardId, file);
    if (!path) {
      setUploading(false);
      setError(uploadError ?? "Не удалось загрузить фото.");
      return;
    }
    await supabase.from("boards").update({ background_image_path: path }).eq("id", boardId);
    if (oldPath) {
      await supabase.storage.from("board-backgrounds").remove([oldPath]);
    }
    setUploading(false);
    onChanged();
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Фон доски</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <button
          type="button"
          className={`bg-photo-upload${currentImagePath ? " active" : ""}`}
          style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {!previewUrl && <span>{uploading ? "Загружаем…" : "📷 Своё фото"}</span>}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          style={{ display: "none" }}
        />
        {error && <div className="error-text">{error}</div>}

        <p className="sub" style={{ marginTop: 14 }}>
          Или выберите один из фонов сезона (палитра Pantone 2026):
        </p>
        <div className="bg-grid">
          {BOARD_BACKGROUNDS.map((bg) => (
            <button
              key={bg.id}
              className={`bg-swatch${!currentImagePath && (current ?? "default") === bg.id ? " active" : ""}`}
              style={bg.css ? { background: bg.css } : undefined}
              onClick={() => pick(bg.id)}
              title={bg.label}
            >
              {!bg.css && <span className="bg-swatch-none" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
