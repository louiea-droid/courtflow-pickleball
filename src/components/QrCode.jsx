import { useEffect, useState } from "react";

// Always dark-on-white, whatever the theme, so phone cameras can read it.
export default function QrCode({ value, size = 160, label = "QR code" }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    import("qrcode").then((m) => m.toDataURL(value, { margin: 1, width: size * 2 }))
      .then((url) => live && setSrc(url))
      .catch(() => live && setSrc(""));
    return () => { live = false; };
  }, [value, size]);
  return src
    ? <img className="qr" src={src} width={size} height={size} alt={label} />
    : <div className="qr" style={{ width: size, height: size }} />;
}
