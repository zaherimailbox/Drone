import { eventBus } from './core/event-bus.js';
import { DetectorControl } from './modules/detector-control/detector-control.js?v=audio-route-1';
import { SonarAudio } from './modules/sonar-audio/sonar-audio.js?v=audio-route-1';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Metal Detector Module
  const detector = new DetectorControl();
  detector.init();

  const sonarAudio = new SonarAudio();
  sonarAudio.init();

  // Terminal Logger Listener
  const terminalArea = document.querySelector('.terminal-scroll-area');
  eventBus.on('logger:entry', ({ type, msg }) => {
    if (!terminalArea) return;
    const now = new Date();
    const timeStr = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="log-time">${timeStr}</span><span class="log-msg">${msg}</span>`;
    terminalArea.appendChild(entry);
    terminalArea.scrollTop = terminalArea.scrollHeight;
  });

  console.log('[Cockpit GCS] System Initialized with Modular Architecture.');
});
