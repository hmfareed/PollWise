import React, { useEffect, useRef, useState } from "react";
import { Camera, Trash2, Upload, AlertCircle, Loader2 } from "lucide-react";
import { apiClient, getAssetUrl } from "../../lib/api-client";
import { Button } from "../ui/button";

interface CandidatePhotoUploadProps {
  value?: string | null;
  onChange: (photoUrl: string) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

export const CandidatePhotoUpload: React.FC<CandidatePhotoUploadProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setImgError(false);
  }, [value]);

  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImgError(false);

    // 1. Client-side MIME / type check
    const isExtensionAllowed = /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    const isMimeAllowed = ALLOWED_TYPES.includes(file.type.toLowerCase());
    if (!isExtensionAllowed || (file.type && !isMimeAllowed)) {
      setError("Only image files (PNG, JPG, WebP, GIF) are permitted.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // 2. Client-side size check
    if (file.size > MAX_FILE_SIZE) {
      setError("File size exceeds 5MB limit.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Create immediate local object URL preview for instant feedback
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
    }
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);

    // 3. Upload to server
    setIsUploading(true);
    try {
      const res = await apiClient.uploadCandidatePhoto(file);
      onChange(res.photo_url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload photo";
      setError(message);
      setLocalPreview(null);
      URL.revokeObjectURL(previewUrl);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
    setImgError(false);
    onChange("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const displaySrc = localPreview || (value ? getAssetUrl(value) : "");
  const hasValidImage = Boolean(displaySrc && !imgError);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-foreground">
        Candidate Profile Picture
      </label>

      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-4 p-3 rounded-xl border border-border bg-surface/50">
        {/* Avatar Display / Preview */}
        <div className="relative h-16 w-16 rounded-full bg-slate-100 border border-border flex items-center justify-center shrink-0 overflow-hidden">
          {hasValidImage ? (
            <img
              src={displaySrc}
              alt="Candidate preview"
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <Camera className="h-6 w-6 text-slate-400" />
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1 space-y-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled || isUploading}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="text-xs h-8 gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              {isUploading
                ? "Uploading..."
                : hasValidImage
                ? "Change Photo"
                : "Upload Candidate Photo"}
            </Button>

            {(displaySrc || value) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || isUploading}
                onClick={handleRemove}
                className="text-xs h-8 text-danger hover:text-red-700 hover:bg-red-50 gap-1"
                aria-label="Remove photo"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            PNG, JPG, WebP or GIF up to 5MB. Clear headshot recommended.
          </p>
        </div>
      </div>
    </div>
  );
};
