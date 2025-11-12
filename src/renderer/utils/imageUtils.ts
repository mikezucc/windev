// Cache for blob URLs to avoid re-fetching
const blobUrlCache = new Map<string, string>();

/**
 * Converts an external image URL to a blob URL that can be used with CSP restrictions
 * @param url The external URL to convert
 * @returns A blob URL or null if conversion fails
 */
export async function convertToBlobUrl(url: string): Promise<string | null> {
  // Check cache first
  if (blobUrlCache.has(url)) {
    return blobUrlCache.get(url)!;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch image:', response.statusText);
      return null;
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    // Cache the result
    blobUrlCache.set(url, blobUrl);
    
    return blobUrl;
  } catch (error) {
    console.error('Error converting to blob URL:', error);
    return null;
  }
}

/**
 * Cleans up blob URLs to free memory
 * Should be called when component unmounts
 */
export function cleanupBlobUrls(urls?: string[]) {
  if (urls) {
    urls.forEach(url => {
      const blobUrl = blobUrlCache.get(url);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrlCache.delete(url);
      }
    });
  } else {
    // Clean up all cached URLs
    blobUrlCache.forEach(blobUrl => {
      URL.revokeObjectURL(blobUrl);
    });
    blobUrlCache.clear();
  }
}