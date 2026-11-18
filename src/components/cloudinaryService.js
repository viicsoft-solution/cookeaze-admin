// src/components/cloudinaryService.js
//
// Unsigned Cloudinary uploads. Only the cloud name and an *unsigned* upload
// preset are needed in the browser — no API key or secret is shipped to users.
// Configure in .env:
//   REACT_APP_CLOUDINARY_CLOUD_NAME=day9iwtpb
//   REACT_APP_CLOUDINARY_UPLOAD_PRESET=cookeaze_admin

const DEFAULT_CLOUD_NAME = "day9iwtpb";
const DEFAULT_UPLOAD_PRESET = "cookeaze_admin";

class CloudinaryService {
  cloudName =
    (process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "").trim() ||
    DEFAULT_CLOUD_NAME;
  uploadPreset =
    (process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "").trim() ||
    DEFAULT_UPLOAD_PRESET;
  lastError = null;

  isConfigured() {
    return Boolean(this.cloudName && this.uploadPreset);
  }

  /**
   * Upload an image or video file to Cloudinary.
   * Returns the secure URL, or null on failure (reason kept in `lastError`).
   */
  async uploadMedia(file, { folder = "cookeaze_uploads" } = {}) {
    if (!this.isConfigured()) {
      this.lastError = "Cloudinary is not configured";
      return null;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", this.uploadPreset);
      if (folder) formData.append("folder", folder);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`,
        { method: "POST", body: formData }
      );
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.secure_url) {
        this.lastError = null;
        return data.secure_url;
      }

      this.lastError =
        data?.error?.message || `Upload failed (HTTP ${res.status})`;
      console.error("Cloudinary upload failed:", this.lastError);
      return null;
    } catch (e) {
      this.lastError = e?.message || "Network error while uploading image";
      console.error("Cloudinary upload error:", e);
      return null;
    }
  }

  /**
   * Returns the uploaded URL or throws with Cloudinary's reason.
   */
  async uploadFile(file, { folder = "cookeaze_uploads" } = {}) {
    const url = await this.uploadMedia(file, { folder });
    if (!url) {
      throw new Error(
        `Image upload failed: ${this.lastError || "Unknown Cloudinary error"}`
      );
    }
    return url;
  }
}

const cloudinaryService = new CloudinaryService();
export default cloudinaryService;
