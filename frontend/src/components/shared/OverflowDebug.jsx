import { useEffect, useState } from "react";

/**
 * TEMPORARY diagnostic — remove after the mobile horizontal-overflow bug is fixed.
 * Activate by loading any page with `?ofdebug` (stays on for the browser session).
 * Renders a fixed banner listing every element whose box extends past the
 * viewport edges — the actual cause of horizontal scroll, even on WebKit/iOS
 * where desktop DevTools can't reproduce it.
 */
export default function OverflowDebug() {
  const [lines, setLines] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("ofdebug")) {
      window.sessionStorage.setItem("ofdebug", "1");
    }
    if (window.sessionStorage.getItem("ofdebug") !== "1") {
      return;
    }

    const scan = () => {
      const vw = document.documentElement.clientWidth;
      const out = [...document.querySelectorAll("body *")]
        .map((el) => [el, el.getBoundingClientRect()])
        .filter(([, r]) => r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5))
        .map(
          ([el, r]) =>
            `${el.tagName.toLowerCase()}.${String(el.className || "")
              .split(" ")
              .slice(0, 4)
              .join(".")} L${Math.round(r.left)} R${Math.round(r.right)} W${Math.round(r.width)}`,
        )
        .slice(0, 15);
      setLines([
        `vw ${vw} · scrollW ${document.documentElement.scrollWidth}`,
        ...(out.length ? out : ["NO overflow detected"]),
      ]);
    };

    scan();
    const id = window.setInterval(scan, 1500);
    return () => window.clearInterval(id);
  }, []);

  if (!lines.length) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "rgba(220,38,38,0.96)",
        color: "#fff",
        font: "11px/1.4 ui-monospace, monospace",
        padding: "8px 10px",
        maxHeight: "45vh",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        pointerEvents: "none",
      }}
    >
      {lines.join("\n")}
    </div>
  );
}
