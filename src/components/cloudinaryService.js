// src/services/CloudinaryService.js
import sha1 from "js-sha1";

class CloudinaryService {
  cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME ?? "";
  apiKey = process.env.REACT_APP_CLOUDINARY_API_KEY ?? "";
  apiSecret = process.env.REACT_APP_CLOUDINARY_API_SECRET ?? "";

  /**
   * Upload image or video file to Cloudinary.
   * Automatically detects media type (image/video) using "auto/upload".
   */
  async uploadMedia(file, { folder = "cookeaze_uploads" } = {}) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);

      // Signature: "folder=<folder>&timestamp=<timestamp><apiSecret>"
      const paramsToSign = `folder=${folder}&timestamp=${timestamp}${this.apiSecret}`;
      const signature = sha1(paramsToSign);

      const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/auto/upload`;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", this.apiKey);
      formData.append("timestamp", String(timestamp));
      formData.append("signature", signature);
      formData.append("folder", folder);

      const res = await fetch(url, { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        const uploadedUrl = data.secure_url;
        console.log("✅ Cloudinary Upload Success:", uploadedUrl);
        return uploadedUrl;
      }

      console.log("❌ Cloudinary Upload Failed:", data);
      return null;
    } catch (e) {
      console.log("⚠️ Cloudinary Upload Error:", e);
      return null;
    }
  }

  /**
   * Firebase-style method: returns URL or throws
   */
  async uploadFile(file, { folder = "cookeaze_uploads" } = {}) {
    const url = await this.uploadMedia(file, { folder });
    if (!url) throw new Error("Cloudinary upload failed.");
    return url;
  }
}

const cloudinaryService = new CloudinaryService();
export default cloudinaryService;

