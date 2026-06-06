"use client";

// QR + copyable link to this room, shown as a popover in the room header. The
// value is the current URL, so once deployed (or on the LAN) a phone can scan
// it to join the SAME live match.
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { Icon } from "./ui";

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
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  };

  return (
    <div className="room-qr-wrap" data-testid="room-qr">
      <button
        className="btn btn-chrome"
        data-testid="qr-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="qr" size={16} /> {open ? "Hide QR" : "Scan to join"}
      </button>
      {open && (
        <div className="qr-pop pop-in">
          <div className="qr" style={{ padding: 10 }}>
            <QRCode value={url} size={156} />
          </div>
          <div className="qr-url mono">{url}</div>
          <button className="btn btn-chrome btn-sm btn-block" onClick={copy}>
            {copied ? (
              <>
                <Icon name="check" size={14} /> Copied
              </>
            ) : (
              <>
                <Icon name="copy" size={14} /> Copy link
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
