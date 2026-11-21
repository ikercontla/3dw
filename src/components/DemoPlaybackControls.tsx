import { Gauge, Pause, Play, Sparkles } from "lucide-react";
import type { QualityMode } from "@/types/wms";

interface DemoPlaybackControlsProps {
  paused: boolean;
  speed: number;
  quality: QualityMode;
  onTogglePause: () => void;
  onSpeedChange: (speed: number) => void;
  onQualityChange: (quality: QualityMode) => void;
}

const SPEED_OPTIONS = [1, 2, 4, 8] as const;

export function DemoPlaybackControls({
  paused,
  speed,
  quality,
  onTogglePause,
  onSpeedChange,
  onQualityChange,
}: DemoPlaybackControlsProps) {
  const isHigh = quality === "high";

  return (
    <div className="wms-playback-card" role="group" aria-label="Controles de reproducción y calidad">
      <button
        type="button"
        className={`wms-play-btn ${paused ? "is-paused" : ""}`}
        onClick={onTogglePause}
        title={paused ? "Reanudar recorrido (Espacio)" : "Pausar recorrido (Espacio)"}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
        <span>{paused ? "Reanudar" : "Pausar"}</span>
      </button>

      <div className="wms-speed-group" role="group" aria-label="Velocidad de simulación">
        {SPEED_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`wms-speed-btn ${speed === opt ? "is-active" : ""}`}
            onClick={() => onSpeedChange(opt)}
            title={`Velocidad ${opt}×`}
          >
            {opt}×
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`wms-quality-btn ${isHigh ? "is-high" : ""}`}
        onClick={() => onQualityChange(isHigh ? "balanced" : "high")}
        title={
          isHigh
            ? "Calidad Alta (N8AO + sombras 4K) — clic para cambiar a Balanced"
            : "Calidad Balanceada (sombras 2K) — clic para cambiar a High"
        }
      >
        {isHigh ? <Sparkles size={13} /> : <Gauge size={13} />}
        <span>{isHigh ? "High" : "Balanced"}</span>
      </button>
    </div>
  );
}

export default DemoPlaybackControls;
