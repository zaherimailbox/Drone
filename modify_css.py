import os

css_path = 'modules/detector-control/detector-control.css'
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

new_css = """
/* --- Oscilloscope Styling --- */
.oscilloscope-chassis {
  background: #050a0f;
  border: 2px solid #223344;
  border-radius: 6px;
  position: relative;
  margin-bottom: 20px;
  box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.8), 0 0 10px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}
#oscilloscope-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.os-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  background-image: 
    linear-gradient(rgba(0, 255, 128, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 255, 128, 0.1) 1px, transparent 1px);
  background-size: 20px 20px;
}
.os-label {
  position: absolute;
  font-size: 9px;
  font-family: 'Consolas', monospace;
  padding: 2px 4px;
  background: rgba(0,0,0,0.5);
  border-radius: 3px;
}
.tx-label { top: 5px; left: 5px; color: #00e676; }
.rx-label { bottom: 5px; right: 5px; color: #ffb300; }

/* --- Precision Ticks --- */
.tuner-scale-fine-ticks {
  position: absolute;
  top: 0; left: 0; right: 0; height: 100%;
  background: repeating-linear-gradient(90deg, transparent, transparent 4px, #455a64 4px, #455a64 5px);
  opacity: 0.5;
  pointer-events: none;
}
.tuner-scale-ticks span {
  position: relative;
  z-index: 2;
  text-shadow: 0 0 4px #000;
}

.knobs-cluster {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  flex-wrap: wrap;
}

.knob-unit {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.knob-scale-ring {
  position: absolute;
  top: -8px; left: -8px; right: -8px; bottom: 20px;
  border-radius: 50%;
  background: conic-gradient(from -135deg, transparent 0deg, #455a64 1deg, transparent 2deg, transparent 10deg, #455a64 11deg, transparent 12deg, transparent 20deg);
  opacity: 0.4;
  z-index: 0;
}

/* Audio Selector Ticks */
.selector-ticks {
  background: conic-gradient(from -135deg, #00e5ff 0deg, #00e5ff 2deg, transparent 2deg, transparent 88deg, #00e676 90deg, #00e676 92deg, transparent 92deg, transparent 178deg, #ffb300 180deg, #ffb300 182deg, transparent 182deg, transparent 268deg, #ff3d00 270deg, #ff3d00 272deg, transparent 272deg);
  opacity: 0.8;
}

.audio-selector-unit {
  min-width: 80px;
}
.selector-labels {
  display: flex;
  position: absolute;
  width: 120px;
  top: -15px;
  justify-content: space-between;
  font-size: 8px;
  color: #90a4ae;
  font-family: 'Consolas', monospace;
  font-weight: bold;
}
.selector-labels span:nth-child(1) { position: absolute; left: 0; top: 70px; transform: rotate(-45deg); }
.selector-labels span:nth-child(2) { position: absolute; left: 15px; top: 10px; }
.selector-labels span:nth-child(3) { position: absolute; right: 15px; top: 10px; }
.selector-labels span:nth-child(4) { position: absolute; right: 0; top: 70px; transform: rotate(45deg); }
"""

with open(css_path, 'a', encoding='utf-8') as f:
    f.write(new_css)

print("CSS modifications complete.")
