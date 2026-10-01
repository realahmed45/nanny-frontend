import { useEffect, useState } from 'react';
import { mediaUrl, getToken } from '../lib/api.js';

/**
 * Files kept behind the dashboard login: identity documents, certificates,
 * contracts and payment receipts.
 *
 * The server only hands these out to a request carrying the admin's token,
 * and a plain `<img src>` or `<a href>` cannot send one — so every private
 * file rendered that way came back 401 and showed as broken. These fetch the
 * file with the token and point the element at the downloaded copy instead.
 * Public media is passed straight through, exactly as before.
 */
const isPrivate = (url) => typeof url === 'string' && url.startsWith('/media-private/');

export function useMediaSrc(url) {
  const [src, setSrc] = useState(() => (isPrivate(url) ? null : mediaUrl(url)));

  useEffect(() => {
    if (!isPrivate(url)) {
      setSrc(mediaUrl(url));
      return undefined;
    }

    let objectUrl = null;
    let cancelled = false;
    setSrc(null);

    fetch(mediaUrl(url), { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (cancelled) return;
        // Only images and PDFs are opened as themselves. Anything else is
        // re-typed so the browser downloads it instead of rendering it: a
        // blob: URL runs with the dashboard's own origin, so an HTML or SVG
        // file sent in as an "ID" could otherwise read the admin's login.
        const safe = /^image\/(png|jpe?g|gif|webp|heic|heif)$|^application\/pdf$/i.test(blob.type)
          ? blob
          : new Blob([blob], { type: 'application/octet-stream' });
        objectUrl = URL.createObjectURL(safe);
        setSrc(objectUrl);
      })
      .catch(() => { if (!cancelled) setSrc(null); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return src;
}

export function MediaImg({ url, alt = '', ...props }) {
  const src = useMediaSrc(url);
  if (!src) return <span className="text-xs text-slate-500">Loading…</span>;
  return <img src={src} alt={alt} {...props} />;
}

export function MediaLink({ url, children, ...props }) {
  const src = useMediaSrc(url);
  return (
    <a href={src || undefined} target="_blank" rel="noreferrer" aria-disabled={!src} {...props}>
      {children}
    </a>
  );
}
