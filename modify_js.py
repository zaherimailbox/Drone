import os
import re

js_path = 'modules/detector-control/detector-control.js'
with open(js_path, 'r', encoding='utf-8') as f:
    js = f.read()

# Add audio mode and oscilloscope vars to constructor
js = js.replace("this.burstDutyPct = 60;", "this.burstDutyPct = 60;\n    this.audioMode = 0; // 0=MUTE, 1=TX, 2=RX, 3=T/R\n    this.osTime = 0;")

# Cache elements for audio selector and canvas
cache_additions = """
    this.elements.knobAudio = knobs[4];
    this.elements.canvas = document.getElementById('oscilloscope-canvas');
    if (this.elements.canvas) {
      this.ctx = this.elements.canvas.getContext('2d');
      this.startOscilloscope();
    }
"""
js = js.replace("this.elements.labelBurstDuty = labels[3];", "this.elements.labelBurstDuty = labels[3];\n" + cache_additions)

# Bind events for audio knob
bind_additions = """
    this.setupKnobControl(this.elements.knobAudio, (delta) => {
      if (!this.isPoweredOn || this.isSelfTesting) return;
      this.audioMode = Math.min(3, Math.max(0, this.audioMode + delta));
      this.updateUI();
    });
"""
js = js.replace("this.setupKnobControl(this.elements.knobBurstDuty, (delta) => {\n      this.setBurstDuty(this.burstDutyPct + delta);\n    });", 
                "this.setupKnobControl(this.elements.knobBurstDuty, (delta) => {\n      this.setBurstDuty(this.burstDutyPct + delta);\n    });\n" + bind_additions)

# Update UI for audio knob
ui_additions = """
    if (this.elements.knobAudio) {
      const angle = -135 + (this.audioMode / 3) * 270;
      if (!this.isSelfTesting) this.elements.knobAudio.style.transform = `rotate(${angle}deg)`;
      const modes = ['MUTE', 'TX', 'RX', 'T/R'];
      this.elements.knobAudio.setAttribute('aria-valuenow', String(this.audioMode));
      this.elements.knobAudio.setAttribute('aria-valuetext', modes[this.audioMode]);
    }
"""
js = js.replace("if (this.elements.labelFreq && !this.isSelfTesting) {", ui_additions + "\n    if (this.elements.labelFreq && !this.isSelfTesting) {")

# Add Oscilloscope render loop
os_loop = """
  startOscilloscope() {
    const draw = () => {
      requestAnimationFrame(draw);
      if (!this.ctx || !this.elements.canvas) return;
      
      const width = this.elements.canvas.width;
      const height = this.elements.canvas.height;
      this.ctx.clearRect(0, 0, width, height);
      
      if (!this.isPoweredOn) return;
      
      this.osTime += 0.5 * (this.freqKHz / 10);
      
      // TX Wave
      this.ctx.beginPath();
      this.ctx.strokeStyle = '#00e676';
      this.ctx.lineWidth = 2;
      const txAmp = this.isFiring ? 40 * (this.carrierDutyPct / 50) : 5;
      for (let x = 0; x < width; x++) {
        const y = height / 2 + Math.sin(x * 0.05 + this.osTime) * txAmp;
        if (x === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();
      
      // RX Wave (Echo, Phase shifted)
      this.ctx.beginPath();
      this.ctx.strokeStyle = '#ffb300';
      this.ctx.lineWidth = 2;
      const rxAmp = this.isFiring ? txAmp * 0.5 + (Math.random()*5) : 2;
      const phaseShift = Math.PI / 3;
      for (let x = 0; x < width; x++) {
        const y = height / 2 + Math.sin(x * 0.05 + this.osTime + phaseShift) * rxAmp;
        if (x === 0) this.ctx.moveTo(x, y);
        else this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();
    };
    draw();
  }
"""
js = js.replace("updateUI() {", os_loop + "\n  updateUI() {")

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js)

print("JS modifications complete.")
