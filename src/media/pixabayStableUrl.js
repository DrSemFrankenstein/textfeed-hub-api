export function isPixabayCdnPhotoUrl(url) {
  return typeof url === 'string' && /^https:\/\/cdn\.pixabay\.com\/photo\//i.test(url);
}

/** Pixabay API often returns expiring pixabay.com/get/ links for large/webformat — derive CDN from previewURL. */
export function largeImageFromPixabayPreview(previewURL) {
  if (!isPixabayCdnPhotoUrl(previewURL)) return null;
  return String(previewURL).replace(/_\d+(\.[a-z]+)$/i, '_1280$1');
}

export function stablePixabayImageFromHit(hit) {
  if (!hit) return null;
  const preview = String(hit.previewURL || '').trim();
  const fromPreview = largeImageFromPixabayPreview(preview);
  const candidates = [hit.largeImageURL, hit.webformatURL, hit.fullHDURL, hit.imageURL, fromPreview].filter(
    Boolean,
  );
  for (const url of candidates) {
    if (isPixabayCdnPhotoUrl(url)) return url;
  }
  return fromPreview || (isPixabayCdnPhotoUrl(preview) ? preview : null);
}

export function stablePixabayThumbFromHit(hit, imageUrl) {
  const preview = String(hit?.previewURL || '').trim();
  if (isPixabayCdnPhotoUrl(preview)) return preview;
  if (isPixabayCdnPhotoUrl(imageUrl)) {
    return String(imageUrl).replace(/_1280(\.[a-z]+)$/i, '_640$1');
  }
  return preview || imageUrl || null;
}
