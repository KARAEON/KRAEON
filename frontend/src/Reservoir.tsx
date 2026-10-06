type ReservoirProps = {
  level: number;
  protectedLevel?: number;
  paused: boolean;
  reset: number;
  showDetails: boolean;
  onToggleDetails: () => void;
};

const ASSET_ROOT = "/dam-system-v2";
const DAM_ART = `${ASSET_ROOT}/dam-smooth-transparent.png`;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function waterMask(level: number) {
  return `${ASSET_ROOT}/masks/water-${String(level).padStart(3, "0")}.png`;
}

export default function Reservoir({ level, protectedLevel = 0, paused, reset, showDetails, onToggleDetails }: ReservoirProps) {
  const actualPercent = clamp(level * 100, 0, 100);
  const protectedPercent = clamp(protectedLevel * 100, 0, 100);
  // The scene's visible water communicates allocable storage above the
  // protected reserve, while the metrics continue to report actual storage.
  const percent = protectedPercent >= 100
    ? 0
    : clamp((actualPercent - protectedPercent) / (100 - protectedPercent) * 100, 0, 100);
  const low = Math.floor(percent / 5) * 5;
  const high = Math.min(100, low + 5);
  const mix = high === low ? 0 : (percent - low) / (high - low);
  // Fade the painted spillway into a dry, monochrome riverbed near empty storage.
  const dryWaterwayOpacity = clamp((24 - percent) / 24, 0, 1);
  const maskStyle = (maskLevel: number, opacity: number) => ({
    WebkitMaskImage: `url("${waterMask(maskLevel)}")`,
    maskImage: `url("${waterMask(maskLevel)}")`,
    opacity,
  });

  return (
    <section
      className={`dam-system-model${paused ? " is-paused" : ""}${percent <= 0.5 ? " is-empty" : ""}`}
      data-level={Math.round(actualPercent)}
      data-usable-level={Math.round(percent)}
      data-reset={reset}
      role="button"
      tabIndex={0}
      aria-expanded={showDetails}
      aria-label={`Reservoir at ${Math.round(actualPercent)} percent closing storage, with ${Math.round(protectedPercent)} percent protected reserve and ${Math.round(percent)} percent usable storage above reserve. Activate to ${showDetails ? "hide" : "show"} details.`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggleDetails();
        }
      }}
    >
      <div className="dam-system-artboard" aria-hidden="true" onClick={onToggleDetails}>
        <img className="dam-system-base" src={DAM_ART} alt="" draggable={false} />
        <img className="dam-system-dry-basin" src={`${ASSET_ROOT}/dry-basin.png`} alt="" draggable={false} />
        <div className="dam-system-water" style={maskStyle(low, 1 - mix)}>
          <img src={DAM_ART} alt="" draggable={false} />
        </div>
        <div className="dam-system-water" style={maskStyle(high, mix)}>
          <img src={DAM_ART} alt="" draggable={false} />
        </div>
        <div className="dam-system-dry-waterways" style={{ opacity: dryWaterwayOpacity }}>
          <img src={DAM_ART} alt="" draggable={false} />
          <i />
        </div>
      </div>

    </section>
  );
}
