import re

with open('modules/detector-control/detector-control.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Expand flex
content = content.replace('style="flex: 1.8;"', 'style="flex: 2.3;"')

# 2. Add Oscilloscope Canvas
oscilloscope_html = """
              <!-- Industrial Oscilloscope -->
              <div class="oscilloscope-chassis">
                <canvas id="oscilloscope-canvas" width="600" height="150"></canvas>
                <div class="os-overlay">
                  <span class="os-label tx-label">CH1: TX (DRIVE)</span>
                  <span class="os-label rx-label">CH2: RX (ECHO)</span>
                  <span class="os-grid"></span>
                </div>
              </div>
"""
content = content.replace('<div class="detector-apparatus">', oscilloscope_html + '\n              <div class="detector-apparatus">')

# 3. Add ticks to the tuner scale (coarse and fine)
fine_ticks_html = """
                  <div class="tuner-scale-fine-ticks"></div>
"""
content = content.replace('<div class="tuner-scale-ticks">', fine_ticks_html + '\n                  <div class="tuner-scale-ticks">')

# 4. Add ticks to all knobs
for i in range(4):
    content = re.sub(r'(<div class="rotary-knob"[^>]*>)', r'<div class="knob-scale-ring"></div>\n                    \1', content, count=1)

# 5. Add a 5th knob for Audio Selector
audio_knob_html = """
                <div class="knob-unit audio-selector-unit">
                  <div class="knob-scale-ring selector-ticks"></div>
                  <div class="rotary-knob selector-knob" role="slider" tabindex="0" aria-label="Audio Mode" aria-valuemin="0" aria-valuemax="3" aria-valuestep="1" aria-valuenow="0" aria-valuetext="MUTE">
                    <div class="rotary-knob-indicator"></div>
                  </div>
                  <span class="knob-label">AUDIO OUT</span>
                  <div class="selector-labels">
                    <span>MUTE</span>
                    <span>TX</span>
                    <span>RX</span>
                    <span>T/R</span>
                  </div>
                </div>
"""
content = content.replace('</div>\n              </div>\n\n              <!-- Mode Toggle', audio_knob_html + '</div>\n              </div>\n\n              <!-- Mode Toggle')

with open('modules/detector-control/detector-control.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("HTML modifications complete.")
