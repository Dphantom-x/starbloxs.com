"use client";

// QR + copyable link to this room. The value is the current URL, so once the
// app is deployed (or served on the LAN) a phone can scan it to join the SAME
// match. On localhost the QR points at localhost (use it after deploy / on LAN).
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

export default function RoomQR() {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  if (!url) return null;

  const copy = () => {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <div data-testid="room-qr" className="inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        data-testid="qr-toggle"
        className="rounded-md border border-black/15 px-2.5 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        {open ? "Hide QR" : "📱 Scan to join"}
      </button>
      {open && (
        <div className="mt-2 inline-block rounded-lg border border-black/10 bg-white p-3 dark:border-white/15">
          <QRCode value={url} size={140} />
          <div className="mt-2 flex max-w-[160px] items-center gap-2">
            <code className="break-all text-[10px] text-gray-500">{url}</code>
            <button
              onClick={copy}
              className="shrink-0 rounded border border-black/15 px-1.5 py-0.5 text-[10px] dark:border-white/20"
            >
              {copied ? "✓" : "copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
