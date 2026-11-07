import React, { useEffect, useRef, useState } from "react";
import { Camera, Trash2, Upload, AlertCircle, Loader2 } from "lucide-react";
import { apiClient, getAssetUrl } from "../../lib/api-client";
import { Button } from "../ui/button";

interface ElectionPhotoUploadProps {
  value?: string | null;
  onChange: (photoUrl: string) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

export const ElectionPhotoUpload: React.FC<ElectionPhotoUploadProps> = ({
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
      const res = await apiClient.uploadElectionPhoto(file);
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
      <div className="flex items-center gap-4">
        {/* Circular Avatar Preview Container */}
        <div className="relative group shrink-0">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-200 bg-slate-50 flex items-center justify-center shadow-xs">
            {hasValidImage ? (
              <img
                src={displaySrc}
                alt="Election Profile Preview"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="text-slate-400 flex flex-col items-center justify-center p-2 text-center">
                <Camera className="w-6 h-6 stroke-[1.5]" />
              </div>
            )}
          </div>

          {/* Uploading Spinner Overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-white/70 rounded-full flex items-center justify-center backdrop-blur-2xs">
              <Loader2 className="w-6 h-6 text-[#0055FF] animate-spin" />
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              id="election-photo-upload-input"
              aria-label="Upload Election Logo"
              accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={handleFileChange}
              disabled={disabled || isUploading}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 cursor-pointer text-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              {hasValidImage ? "Change Photo" : "Upload Election Logo"}
            </Button>

            {hasValidImage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Remove photo"
                disabled={disabled || isUploading}
                onClick={handleRemove}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1 text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </Button>
            )}
          </div>

          <p className="text-[11px] text-slate-500">
            Circular profile picture for this election. PNG, JPG, or WebP up to 5MB.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
