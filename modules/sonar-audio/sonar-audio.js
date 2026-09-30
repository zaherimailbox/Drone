import { eventBus } from '../../core/event-bus.js';

export class SonarAudio {
  constructor() {
    this.mode = 'BOTH';
    this.detectorPowered = true;
    this.audioContext = null;
    this.masterGain = null;
    this.txChannel = null;
    this.rxChannel = null;
    this.waveTimer = null;
    this.elements = {};
  }

  init() {
    this.elements.modeButtons = document.querySelectorAll('.sonar-mode-option');
    this.elements.sonarTag = document.querySelector('.sonar-tag');
    this.elements.soundwave = document.querySelector('.sonar-soundwave');

    this.elements.modeButtons.forEach((button) => {
      button.addEventListener('click', () => this.setMode(button.dataset.audioMode));
    });

    eventBus.on('detector:fire_pulse', (pulse) => this.playPulse(pulse));
    eventBus.on('detector:freq_changed', ({ freq }) => this.updateFrequencyLabel(freq));
    eventBus.on('detector:power_changed', ({ poweredOn }) => {
      if (typeof poweredOn === 'boolean') {
        this.detectorPowered = poweredOn;
        this.updateChannelGains();
      }
    });

    // The AUDIO OUT potentiometer on the detector card is the master routing control
    eventBus.on('detector:audio_mode_changed', ({ mode }) => this.setMode(mode, { broadcast: false }));

    this.updateModeUI();
  }

  setMode(mode, { broadcast = true } = {}) {
    if (!['MUTE', 'TX', 'RX', 'BOTH'].includes(mode)) return;
    const changed = this.mode !== mode;
    this.mode = mode;
    this.updateModeUI();
    this.updateChannelGains();

    if (broadcast && changed) {
      // Keep the detector's AUDIO OUT potentiometer in sync with this panel
      eventBus.emit('sonar:audio_mode_changed', { mode: this.mode });
    }

    if (mode !== 'MUTE') {
      this.ensureAudioContext().catch((error) => {
        console.warn('[Sonar Audio] Unable to initialize audio:', error);
      });
    }
  }

  updateModeUI() {
    this.elements.modeButtons.forEach((button) => {
      const selected = button.dataset.audioMode === this.mode;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  updateFrequencyLabel(frequency) {
    if (this.elements.sonarTag && Number.isFinite(frequency)) {
      this.elements.sonarTag.textContent = `SONAR: ${frequency.toFixed(1)} kHz PING`;
    }
  }

  async ensureAudioContext() {
    if (!this.audioContext) {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) return null;

      this.audioContext = new AudioContextConstructor();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.32;
      this.masterGain.connect(this.audioContext.destination);
      this.txChannel = this.createChannel(2500);
      this.rxChannel = this.createChannel(1800);
      this.updateChannelGains();
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  createChannel(echoCutoff) {
    const bus = this.audioContext.createGain();
    const input = this.audioContext.createGain();
    const delay = this.audioContext.createDelay(0.5);
    const filter = this.audioContext.createBiquadFilter();
    const feedback = this.audioContext.createGain();
    const wet = this.audioContext.createGain();

    bus.gain.value = 0;
    delay.delayTime.value = 0.35;
    filter.type = 'lowpass';
    filter.frequency.value = echoCutoff;
    feedback.gain.value = 0.28;
    wet.gain.value = 0.55;

    bus.connect(this.masterGain);
    input.connect(bus);
    input.connect(delay);
    delay.connect(filter);
    filter.connect(feedback);
    feedback.connect(delay);
    filter.connect(wet);
    wet.connect(bus);

    return { bus, input };
  }

  updateChannelGains() {
    if (!this.audioContext || !this.txChannel || !this.rxChannel) return;
    const now = this.audioContext.currentTime;
    const txEnabled = this.detectorPowered && (this.mode === 'TX' || this.mode === 'BOTH');
    const rxEnabled = this.detectorPowered && (this.mode === 'RX' || this.mode === 'BOTH');

    for (const [channel, enabled] of [[this.txChannel, txEnabled], [this.rxChannel, rxEnabled]]) {
      channel.bus.gain.cancelScheduledValues(now);
      channel.bus.gain.setTargetAtTime(enabled ? 1 : 0, now, 0.02);
    }
  }

  mapFrequency(frequencyKHz) {
    const normalized = Math.min(1, Math.max(0, (frequencyKHz - 5) / 10));
    return 500 * Math.pow(1400 / 500, normalized);
  }

  async playPulse({ freqKHz, carrierDutyPct = 50, pulseDurationMs = 1320, rxPower, isHit }) {
    this.updateFrequencyLabel(freqKHz);
    if (!this.detectorPowered || this.mode === 'MUTE') return;

    const context = await this.ensureAudioContext();
    if (!context || !this.detectorPowered || this.mode === 'MUTE') return;

    const startAt = context.currentTime + 0.025;
    const frequency = this.mapFrequency(freqKHz);
    const txLevel = 0.14 * Math.min(1, Math.max(0, carrierDutyPct / 100));
    const rxLevel = 0.24 * Math.min(1, Math.max(0, rxPower));
    const pulseDurationSeconds = pulseDurationMs / 1000;
    const txDuration = Math.min(1.1, pulseDurationSeconds);
    const rxDuration = Math.max(0.3, Math.min(0.95, pulseDurationSeconds - 0.25));

    if (this.mode === 'TX' || this.mode === 'BOTH') {
      this.playSubImpact(startAt, txLevel * 0.55);
      this.playTone(this.txChannel, startAt, frequency, txLevel, txDuration, 14);
    }

    if (this.mode === 'RX' || this.mode === 'BOTH') {
      const echoAt = startAt + 0.25;
      this.playTone(this.rxChannel, echoAt, frequency * 0.97, rxLevel, rxDuration, 7);
      if (isHit) {
        const targetEchoDuration = Math.max(0.2, Math.min(0.75, rxDuration - 0.33));
        this.playTone(this.rxChannel, echoAt + 0.33, frequency * 0.94, rxLevel * 0.55, targetEchoDuration, 6);
      }
    }

    this.animateSoundwave();
  }

  playSubImpact(startAt, level) {
    const oscillator = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(120, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(35, startAt + 0.28);
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), startAt + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.3);
    oscillator.connect(envelope);
    envelope.connect(this.txChannel.input);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.32);
    this.disconnectAfter([oscillator, envelope], startAt + 0.4);
  }

  playTone(channel, startAt, frequency, level, duration, resonance) {
    const oscillator = this.audioContext.createOscillator();
    const envelope = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency * 1.035, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(frequency, startAt + 0.045);
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), startAt + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = resonance;

    oscillator.connect(envelope);
    envelope.connect(filter);
    filter.connect(channel.input);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
    this.disconnectAfter([oscillator, envelope, filter], startAt + duration + 0.5);
  }

  disconnectAfter(nodes, endTime) {
    const delay = Math.max(0, endTime - this.audioContext.currentTime) * 1000;
    setTimeout(() => nodes.forEach((node) => node.disconnect()), delay);
  }

  animateSoundwave() {
    if (!this.elements.soundwave) return;
    this.elements.soundwave.classList.add('is-pinging');
    clearTimeout(this.waveTimer);
    this.waveTimer = setTimeout(() => {
      this.elements.soundwave.classList.remove('is-pinging');
    }, 1500);
  }
}