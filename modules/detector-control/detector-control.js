import { eventBus } from '../../core/event-bus.js';

const AUTO_SWEEP_PERIOD_MS = 2200;
const METER_TRAVEL_MS = 400;
const RX_ECHO_DELAY_MS = 250;

/* Oscilloscope trace geometry, expressed on the classic 600x150 scope grid so
   the waveform keeps its shape and fill ratio at any monitor size */
const OSC_GRID_WIDTH = 600;
const OSC_GRID_HEIGHT = 150;
const OSC_FIRE_AMP = 40;
const OSC_IDLE_AMP = 5;
const OSC_IDLE_RX_AMP = 2;
const OSC_TRACE_CYCLES = 4.8; // Carrier cycles visible across the whole grid
const OSC_SPATIAL_K = (Math.PI * 2 * OSC_TRACE_CYCLES) / OSC_GRID_WIDTH; // Radians per grid unit
const OSC_SWEEP_LOCK = 0.025;     // Timebase lock: scrolled cycles per second per kHz
const OSC_RX_PHASE_SHIFT = Math.PI / 3;
const OSC_TX_ATTACK_S = 0.05;     // Burst gate attack / decay time constant
const OSC_RX_ATTACK_S = 0.12;     // RX echo eases in slightly later than the TX burst
const OSC_NOISE_SMOOTH_S = 0.25;  // Low-pass on the RX wander (no per-frame flicker)

/* Manual continuous trigger repeats at the same burst period used by the sweep */
const TRIGGER_LOOP_PERIOD_MS = AUTO_SWEEP_PERIOD_MS;

/* Audio routing selected by the AUDIO OUT potentiometer (values 0..3) */
const AUDIO_MODE_NAMES = ['MUTE', 'TX', 'RX', 'BOTH']; // Routing keys for the sonar engine
const AUDIO_MODE_LABELS = ['MUTE', 'TX', 'RX', 'T/R']; // Knob face / aria labels
const DEFAULT_AUDIO_MODE = 3;                          // TX/RX: both channels audible by default

export class DetectorControl {
  constructor() {
    this.mode = 'AUTO';
    this.freqKHz = 10.0;
    this.freqStepKHz = 0.5;
    this.carrierDutyPct = 50;
    this.burstDutyPct = 60;
    this.audioMode = DEFAULT_AUDIO_MODE; // 0=MUTE, 1=TX, 2=RX, 3=TX/RX
    this.osTime = 0;
    this.osLastFrameAt = 0;
    this.osTxAmp = OSC_IDLE_AMP;
    this.osRxAmp = OSC_IDLE_RX_AMP;
    this.osRxNoise = 0;
    this.isPoweredOn = true;
    this.isSelfTesting = false;
    this.selfTestTimers = [];
    this.isFiring = false;
    this.txResetTimer = null;
    this.pulseEndTimer = null;
    this.rxResetTimer = null;
    this.autoSweepTimer = null;
    this.triggerLoopTimer = null;
    this.isTriggerLoopActive = false;
    this.autoStepIndex = 0;
    this.autoSteps = this.buildAutoSteps();
    this.elements = {};
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.updateUI();
    this.emitAudioMode(); // Publish the default routing for late subscribers
    this.startSelfTest();
  }

  cacheElements() {
    this.elements.module = document.querySelector('.detector-module');
    this.elements.apparatus = document.querySelector('.detector-apparatus');
    this.elements.statusText = document.querySelector('.detector-frequency-range');
    this.elements.pillOff = document.querySelector('.toggle-pill[data-mode="OFF"]');
    this.elements.pillMan = document.querySelector('.toggle-pill[data-mode="MAN"]');
    this.elements.pillAuto = document.querySelector('.toggle-pill[data-mode="AUTO"]');
    this.elements.btnFire = document.querySelector('.btn-pulse-fire');
    this.elements.tunerNeedle = document.querySelector('.tuner-needle');
    this.elements.tunerWindow = document.querySelector('.tuner-glass-window');
    this.elements.txNeedle = document.querySelectorAll('.meter-needle')[0];
    this.elements.rxNeedle = document.querySelectorAll('.meter-needle')[1];
    this.elements.txLed = document.querySelector('.meter-status-led.tx-led');
    this.elements.rxLed = document.querySelector('.meter-status-led.rx-led');

    const knobs = document.querySelectorAll('.rotary-knob');
    this.elements.knobFreq = knobs[0];
    this.elements.knobStep = knobs[1];
    this.elements.knobCarrierDuty = knobs[2];
    this.elements.knobBurstDuty = knobs[3];

    const labels = document.querySelectorAll('.knob-label');
    this.elements.labelFreq = labels[0];
    this.elements.labelStep = labels[1];
    this.elements.labelCarrierDuty = labels[2];
    this.elements.labelBurstDuty = labels[3];

    this.elements.knobAudio = knobs[4];
    this.elements.osTimebase = document.querySelector('.os-timebase-label');
    this.elements.txCanvas = document.getElementById('oscilloscope-tx-canvas');
    this.elements.rxCanvas = document.getElementById('oscilloscope-rx-canvas');
    if (this.elements.txCanvas && this.elements.rxCanvas) {
      this.txCtx = this.elements.txCanvas.getContext('2d');
      this.rxCtx = this.elements.rxCanvas.getContext('2d');
      this.startOscilloscope();
    }

  }

  bindEvents() {
    if (this.elements.pillOff) {
      this.elements.pillOff.addEventListener('click', () => this.setPower(false));
    }

    if (this.elements.pillMan) {
      this.elements.pillMan.addEventListener('click', () => this.setMode('MAN'));
    }
    if (this.elements.pillAuto) {
      this.elements.pillAuto.addEventListener('click', () => this.setMode('AUTO'));
    }

    if (this.elements.btnFire) {
      this.elements.btnFire.addEventListener('click', () => {
        // MAN toggles a continuous trigger loop, AUTO toggles the frequency sweep
        if (this.mode === 'MAN') {
          this.toggleTriggerLoop();
        } else {
          this.toggleAutoSweep();
        }
      });
    }

    this.setupKnobControl(this.elements.knobFreq, (delta) => {
      if (this.mode === 'MAN') this.setFrequency(this.freqKHz + delta * this.freqStepKHz);
    });

    this.setupKnobControl(this.elements.knobStep, (delta) => {
      this.setFrequencyStep(this.freqStepKHz + delta * 0.1);
    });

    this.setupKnobControl(this.elements.knobCarrierDuty, (delta) => {
      this.setCarrierDuty(this.carrierDutyPct + delta);
    });

    this.setupKnobControl(this.elements.knobBurstDuty, (delta) => {
      this.setBurstDuty(this.burstDutyPct + delta);
    });

    this.setupKnobControl(this.elements.knobAudio, (delta) => {
      if (!this.isPoweredOn || this.isSelfTesting) return;
      this.setAudioMode(this.audioMode + delta);
    });

    // The sonar panel's own channel buttons keep the AUDIO OUT knob in sync
    eventBus.on('sonar:audio_mode_changed', ({ mode }) => {
      const index = AUDIO_MODE_NAMES.indexOf(mode);
      if (index === -1 || index === this.audioMode) return;
      this.audioMode = index;
      this.updateUI();
    });


    if (this.elements.tunerWindow) {
      const tunerWindow = this.elements.tunerWindow;
      const setFrequencyFromPointer = (event) => {
        const rect = tunerWindow.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const rawFrequency = 5.0 + ratio * 10.0;
        const stepCount = Math.round((rawFrequency - 5.0) / this.freqStepKHz);
        this.setFrequency(5.0 + stepCount * this.freqStepKHz);
      };

      tunerWindow.addEventListener('pointerdown', (event) => {
        if (!this.isPoweredOn || this.isSelfTesting || this.mode !== 'MAN') return;
        event.preventDefault();
        this.isTuning = true;
        tunerWindow.setPointerCapture(event.pointerId);
        setFrequencyFromPointer(event);
      });
      tunerWindow.addEventListener('pointermove', (event) => {
        if (this.isTuning && this.isPoweredOn && !this.isSelfTesting && this.mode === 'MAN') setFrequencyFromPointer(event);
      });
      const stopTuning = () => {
        this.isTuning = false;
      };
      tunerWindow.addEventListener('pointerup', stopTuning);
      tunerWindow.addEventListener('pointercancel', stopTuning);
      tunerWindow.addEventListener('lostpointercapture', stopTuning);

      tunerWindow.addEventListener('keydown', (event) => {
        if (!this.isPoweredOn || this.isSelfTesting || this.mode !== 'MAN') return;
        const step = event.shiftKey ? this.freqStepKHz * 2 : this.freqStepKHz;
        const adjustments = {
          ArrowLeft: -step,
          ArrowDown: -step,
          ArrowRight: step,
          ArrowUp: step,
          Home: 5.0 - this.freqKHz,
          End: 15.0 - this.freqKHz
        };
        if (Object.hasOwn(adjustments, event.key)) {
          event.preventDefault();
          this.setFrequency(this.freqKHz + adjustments[event.key]);
        }
      });
    }
  }

  setFrequency(frequency) {
    if (!this.isPoweredOn || this.isSelfTesting || this.mode !== 'MAN') return;
    this.freqKHz = Math.min(15.0, Math.max(5.0, +frequency.toFixed(1)));
    this.updateUI();
    eventBus.emit('detector:freq_changed', { freq: this.freqKHz });
  }

  setFrequencyStep(step) {
    if (!this.isPoweredOn || this.isSelfTesting) return;
    const currentFrequency = this.freqKHz;
    this.freqStepKHz = Math.min(2.0, Math.max(0.1, +step.toFixed(1)));
    this.autoSteps = this.buildAutoSteps();

    if (this.autoSweepTimer) {
      const nextStepIndex = this.autoSteps.findIndex((frequency) => frequency > currentFrequency);
      this.autoStepIndex = nextStepIndex === -1 ? 0 : nextStepIndex;
    }

    this.updateUI();
    eventBus.emit('detector:step_changed', { stepKHz: this.freqStepKHz });
  }

  setCarrierDuty(dutyPct) {
    if (!this.isPoweredOn || this.isSelfTesting) return;
    this.carrierDutyPct = Math.min(90, Math.max(10, Math.round(dutyPct)));
    this.updateUI();
    eventBus.emit('detector:carrier_duty_changed', { carrierDutyPct: this.carrierDutyPct });
  }

  setBurstDuty(dutyPct) {
    if (!this.isPoweredOn || this.isSelfTesting) return;
    this.burstDutyPct = Math.min(80, Math.max(40, Math.round(dutyPct)));
    this.updateUI();
    eventBus.emit('detector:burst_duty_changed', { burstDutyPct: this.burstDutyPct });
  }

  /* AUDIO OUT potentiometer: MUTE / TX / RX / TX+RX routing for the sonar engine */
  setAudioMode(nextMode) {
    const clamped = Math.min(3, Math.max(0, Math.round(nextMode)));
    if (clamped === this.audioMode) return;
    this.audioMode = clamped;
    this.updateUI();
    this.emitAudioMode();
  }

  emitAudioMode() {
    eventBus.emit('detector:audio_mode_changed', {
      audioMode: this.audioMode,
      mode: AUDIO_MODE_NAMES[this.audioMode]
    });
  }

  getPulseDurationMs() {
    return AUTO_SWEEP_PERIOD_MS * (this.burstDutyPct / 100);
  }

  buildAutoSteps() {
    const stepTenths = Math.round(this.freqStepKHz * 10);
    const steps = [];
    for (let frequencyTenths = 50; frequencyTenths <= 150; frequencyTenths += stepTenths) {
      steps.push(frequencyTenths / 10);
    }
    if (steps[steps.length - 1] !== 15.0) steps.push(15.0);
    if (!steps.includes(9.4)) steps.push(9.4);
    return [...new Set(steps)].sort((left, right) => left - right);
  }

  setupKnobControl(knobElement, onDelta) {
    if (!knobElement) return;

    knobElement.addEventListener('click', () => knobElement.focus());
    knobElement.addEventListener('keydown', (event) => {
      if (!this.isPoweredOn || this.isSelfTesting) return;
      if (knobElement === this.elements.knobFreq && this.mode !== 'MAN') return;

      const increases = ['ArrowUp', 'ArrowRight', '+', '=', 'Add'];
      const decreases = ['ArrowDown', 'ArrowLeft', '-', '_', 'Subtract'];
      let delta = 0;

      if (increases.includes(event.key)) delta = 1;
      else if (decreases.includes(event.key)) delta = -1;
      else if (event.key === 'Home') delta = -100;
      else if (event.key === 'End') delta = 100;
      else return;

      event.preventDefault();
      onDelta(delta);
    });

    knobElement.addEventListener('wheel', (e) => {
      if (!this.isPoweredOn || this.isSelfTesting) return;
      e.preventDefault();
      onDelta(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    let startY = 0;
    let isDragging = false;

    knobElement.addEventListener('mousedown', (e) => {
      if (!this.isPoweredOn || this.isSelfTesting) return;
      isDragging = true;
      startY = e.clientY;
      const onMove = (ev) => {
        if (!isDragging || !this.isPoweredOn || this.isSelfTesting) return;
        const diff = startY - ev.clientY;
        if (Math.abs(diff) >= 4) {
          onDelta(diff > 0 ? 1 : -1);
          startY = ev.clientY;
        }
      };
      const onUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  setMode(newMode) {
    if (newMode !== 'MAN' && newMode !== 'AUTO') return;
    if (!this.isPoweredOn) this.setPower(true);
    this.mode = newMode;
    if (this.mode === 'MAN') {
      this.stopAutoSweep();
    } else {
      this.stopTriggerLoop(); // Leaving MAN also ends the continuous trigger loop
    }
    this.updateUI();
    eventBus.emit('detector:mode_changed', { mode: this.mode });
  }

  setPower(poweredOn) {
    if (this.isPoweredOn === poweredOn) return;
    this.isPoweredOn = poweredOn;
    this.isTuning = false;

    if (!poweredOn) {
      this.cancelSelfTest();
      this.stopAutoSweep();
      this.stopTriggerLoop();
      this.isFiring = false;
      clearTimeout(this.txResetTimer);
      clearTimeout(this.pulseEndTimer);
      this.txResetTimer = null;
      this.pulseEndTimer = null;
      clearTimeout(this.rxResetTimer);
      this.rxResetTimer = null;
      if (this.elements.txNeedle) {
        this.elements.txNeedle.style.transform = 'rotate(-90deg)';
      }
      if (this.elements.rxNeedle) {
        this.elements.rxNeedle.style.transform = `rotate(${this.rxZeroDbAngle()}deg)`;
      }
      if (this.elements.rxLed) {
        this.elements.rxLed.classList.remove('alert-pulse');
        this.elements.rxLed.style.filter = '';
      }
      if (this.elements.txLed) {
        this.elements.txLed.style.filter = '';
        this.elements.txLed.style.boxShadow = '';
      }
    }

    this.updateUI();
    if (poweredOn) this.startSelfTest();
    eventBus.emit('detector:power_changed', { poweredOn });
  }

  startSelfTest() {
    if (!this.isPoweredOn) return;
    this.cancelSelfTest();
    this.stopTriggerLoop();
    this.isSelfTesting = true;
    if (this.elements.apparatus) {
      this.elements.apparatus.classList.add('is-self-testing');
    }
    this.updateUI();
    this.applySelfTestProgress(0);

    this.selfTestTimers = [
      setTimeout(() => this.applySelfTestProgress(1), 650),
      setTimeout(() => this.applySelfTestProgress(0.5), 1300),
      setTimeout(() => this.finishSelfTest(), 1950)
    ];
  }

  applySelfTestProgress(progress) {
    if (!this.isPoweredOn || !this.isSelfTesting) return;
    const knobAngle = -135 + progress * 270;
    const meterAngle = -90 + progress * 180;

    for (const knob of [this.elements.knobFreq, this.elements.knobStep, this.elements.knobCarrierDuty, this.elements.knobBurstDuty]) {
      if (knob) knob.style.transform = `rotate(${knobAngle}deg)`;
    }
    if (this.elements.tunerNeedle) {
      this.elements.tunerNeedle.style.left = `${5 + progress * 90}%`;
    }
    if (this.elements.txNeedle) {
      this.elements.txNeedle.style.transform = `rotate(${meterAngle}deg)`;
    }
    if (this.elements.rxNeedle) {
      this.elements.rxNeedle.style.transform = `rotate(${meterAngle}deg)`;
    }
    if (this.elements.labelFreq) {
      this.elements.labelFreq.innerText = `TEST ${Math.round(progress * 100)}%`;
    }
    if (this.elements.labelStep) {
      this.elements.labelStep.innerText = `STEP TEST ${Math.round(progress * 100)}%`;
    }
    if (this.elements.labelCarrierDuty) {
      this.elements.labelCarrierDuty.innerText = `CARRIER TEST ${Math.round(progress * 100)}%`;
    }
    if (this.elements.labelBurstDuty) {
      this.elements.labelBurstDuty.innerText = `BURST TEST ${Math.round(progress * 100)}%`;
    }
  }

  finishSelfTest() {
    if (!this.isPoweredOn || !this.isSelfTesting) return;
    this.freqKHz = 10.0;
    this.carrierDutyPct = 50;
    this.burstDutyPct = 60;
    this.audioMode = DEFAULT_AUDIO_MODE; // 0=MUTE, 1=TX, 2=RX, 3=TX/RX
    this.osTime = 0;
    this.isSelfTesting = false;
    this.selfTestTimers = [];
    if (this.elements.apparatus) {
      this.elements.apparatus.classList.remove('is-self-testing');
    }
    if (this.elements.txNeedle) this.elements.txNeedle.style.transform = 'rotate(-90deg)';
    if (this.elements.rxNeedle) {
      this.elements.rxNeedle.style.transform = `rotate(${this.rxZeroDbAngle()}deg)`;
    }
    if (this.elements.rxLed) this.elements.rxLed.classList.remove('alert-pulse');
    this.updateUI();
    this.emitAudioMode(); // Re-publish the post self-test routing
  }

  cancelSelfTest() {
    for (const timer of this.selfTestTimers) clearTimeout(timer);
    this.selfTestTimers = [];
    this.isSelfTesting = false;
    if (this.elements.apparatus) {
      this.elements.apparatus.classList.remove('is-self-testing');
    }
  }

  toggleAutoSweep() {
    if (!this.isPoweredOn || this.isSelfTesting) return;
    if (this.autoSweepTimer) {
      this.stopAutoSweep();
    } else {
      this.startAutoSweep();
    }
  }

  startAutoSweep() {
    if (!this.isPoweredOn || this.isSelfTesting) return;
    this.stopTriggerLoop(); // AUTO sweep and the MAN trigger loop are exclusive
    if (this.autoSweepTimer) clearInterval(this.autoSweepTimer);
    this.autoStepIndex = 0;
    if (this.elements.btnFire) {
      this.elements.btnFire.innerText = 'AUTO RUNNING...';
      this.elements.btnFire.style.filter = 'brightness(1.2)';
    }

    const runStep = () => {
      if (!this.isPoweredOn || this.isSelfTesting) return;
      this.freqKHz = this.autoSteps[this.autoStepIndex];
      this.updateUI();
      this.triggerPulse();
      this.autoStepIndex = (this.autoStepIndex + 1) % this.autoSteps.length;
    };

    this.autoSweepTimer = setInterval(runStep, AUTO_SWEEP_PERIOD_MS);
    runStep();
  }

  stopAutoSweep() {
    if (this.autoSweepTimer) {
      clearInterval(this.autoSweepTimer);
      this.autoSweepTimer = null;
    }
    if (this.elements.btnFire && !this.triggerLoopTimer) {
      // The MAN trigger loop owns the fire button while it is repeating
      this.elements.btnFire.innerText = this.mode === 'AUTO' ? 'START AUTO SWEEP' : 'PULSE FIRE';
      this.elements.btnFire.style.filter = 'none';
    }
  }

  /* --- Continuous Trigger Loop (MAN) --------------------------------------
     PULSE FIRE in manual mode starts a repeating trigger instead of a single
     frozen shot, so the TX burst and the RX echo keep refreshing live on the
     monitor. A second press, OFF, AUTO or a self-test ends the loop.        */
  toggleTriggerLoop() {
    if (this.triggerLoopTimer) {
      this.stopTriggerLoop();
    } else {
      this.startTriggerLoop();
    }
  }

  startTriggerLoop() {
    if (!this.isPoweredOn || this.isSelfTesting || this.mode !== 'MAN') return;
    this.stopTriggerLoop();
    this.isTriggerLoopActive = true;
    this.setFireButtonState('PULSE LOOP LIVE', true);
    this.runTriggerCycle();
    this.triggerLoopTimer = setInterval(() => this.runTriggerCycle(), TRIGGER_LOOP_PERIOD_MS);
  }

  stopTriggerLoop() {
    if (this.triggerLoopTimer) {
      clearInterval(this.triggerLoopTimer);
      this.triggerLoopTimer = null;
    }
    const wasActive = this.isTriggerLoopActive;
    this.isTriggerLoopActive = false;
    if (wasActive) {
      this.isFiring = false; // Trace eases back to the idle carrier (no jump cut)
      this.osTxAmp = OSC_IDLE_AMP;
      this.osRxAmp = OSC_IDLE_RX_AMP;
    }
    this.setFireButtonState(this.mode === 'AUTO' ? 'START AUTO SWEEP' : 'PULSE FIRE', false);
  }

  runTriggerCycle() {
    if (!this.isTriggerLoopActive || !this.isPoweredOn || this.isSelfTesting) return;
    if (this.mode !== 'MAN') {
      this.stopTriggerLoop();
      return;
    }
    if (this.isFiring) return; // Never overlap two bursts
    this.triggerPulse();
  }

  setFireButtonState(label, isLive) {
    const button = this.elements.btnFire;
    if (!button) return;
    button.innerText = label;
    button.classList.toggle('is-live', isLive);
    button.style.filter = isLive ? 'brightness(1.25)' : 'none';
    button.setAttribute('aria-pressed', String(isLive));
    button.title = isLive ? 'Continuous trigger loop active - click again to stop' : '';
  }

  rxZeroDbAngle() {
    const normalized = (0 - (-20)) / (6 - (-20));
    return -90 + normalized * 180;
  }

  txFrequencyIndex() {
    if (this.freqKHz <= 0) return 0;
    const frequency = Math.min(15.0, Math.max(5.0, this.freqKHz));
    return 10 + ((frequency - 5.0) / 10.0) * 90;
  }

  triggerPulse() {
    if (!this.isPoweredOn || this.isSelfTesting || this.isFiring) return;
    this.isFiring = true;
    clearTimeout(this.txResetTimer);
    clearTimeout(this.pulseEndTimer);
    clearTimeout(this.rxResetTimer);
    this.txResetTimer = null;
    this.pulseEndTimer = null;
    this.rxResetTimer = null;
    const pulseDurationMs = this.getPulseDurationMs();

    // Display the frequency-derived TX index across the full semicircle.
    const txTargetAngle = -90 + (this.txFrequencyIndex() / 100) * 180;
    const isResonantPeak = Math.abs(this.freqKHz - 9.4) < 1.0;
    const baseNoise = (Math.random() * 0.15);
    const carrierDrive = this.carrierDutyPct / 100;
    let rxNormalized = isResonantPeak 
      ? 0.75 + (carrierDrive * 0.25) + baseNoise
      : 0.25 + (carrierDrive * 0.2) + baseNoise;
    rxNormalized = Math.min(1.0, rxNormalized);
    const rxDb = -20 + rxNormalized * 26;
    const rxTargetAngle = -90 + ((rxDb + 20) / 26) * 180;

    // TX Needle Jump
    if (this.elements.txNeedle) {
      this.elements.txNeedle.style.transform = `rotate(${txTargetAngle}deg)`;
    }
    if (this.elements.txLed) {
      this.elements.txLed.style.filter = 'brightness(2.2)';
      this.elements.txLed.style.boxShadow = '0 0 16px #00e676';
    }

    this.txResetTimer = setTimeout(() => {
      this.txResetTimer = null;
      if (!this.isPoweredOn) return;
      if (this.elements.txNeedle) {
        this.elements.txNeedle.style.transform = 'rotate(-90deg)';
      }
      if (this.elements.txLed) {
        this.elements.txLed.style.filter = 'brightness(1)';
        this.elements.txLed.style.boxShadow = '0 0 8px #00e676';
      }
    }, Math.max(0, pulseDurationMs - METER_TRAVEL_MS));

    this.pulseEndTimer = setTimeout(() => {
      this.pulseEndTimer = null;
      this.isFiring = false;
    }, pulseDurationMs);

    const gpioConfig = {
      hardwareConnected: false,
      logicLevelsV: { low: 0, high: 3.3 },
      frequencyHz: Math.round(this.freqKHz * 1000),
      carrierDutyPct: this.carrierDutyPct,
      burstPeriodMs: AUTO_SWEEP_PERIOD_MS,
      burstDutyPct: this.burstDutyPct,
      burstActiveMs: Math.round(pulseDurationMs),
      effectiveHighPct: Number((this.carrierDutyPct * this.burstDutyPct / 100).toFixed(1))
    };
    console.info('[TX GPIO CONFIG - SIMULATION ONLY]', gpioConfig);

    // Audio Event
    eventBus.emit('detector:fire_pulse', {
      freqKHz: this.freqKHz,
      carrierDutyPct: this.carrierDutyPct,
      burstDutyPct: this.burstDutyPct,
      burstPeriodMs: AUTO_SWEEP_PERIOD_MS,
      pulseDurationMs,
      rxPower: rxNormalized,
      isHit: isResonantPeak
    });

    // RX Echo delay
    setTimeout(() => {
      if (!this.isPoweredOn) {
        this.isFiring = false;
        return;
      }
      if (this.elements.rxNeedle) {
        this.elements.rxNeedle.style.transform = `rotate(${rxTargetAngle}deg)`;
      }
      if (this.elements.rxLed) {
        if (isResonantPeak) {
          this.elements.rxLed.classList.add('alert-pulse');
          this.elements.rxLed.style.filter = 'brightness(2.5)';
        } else {
          this.elements.rxLed.classList.remove('alert-pulse');
          this.elements.rxLed.style.filter = 'brightness(0.8)';
        }
      }

      eventBus.emit('logger:entry', {
        type: isResonantPeak ? 'hit' : 'info',
        msg: `TX GPIO SIM | ${gpioConfig.frequencyHz} Hz | CARRIER ${this.carrierDutyPct}% | BURST ${this.burstDutyPct}% (${gpioConfig.burstActiveMs} ms) | EFFECTIVE HIGH ${gpioConfig.effectiveHighPct}% | RX ${isResonantPeak ? 'TARGET' : 'NORMAL'}`
      });

      this.rxResetTimer = setTimeout(() => {
        this.rxResetTimer = null;
        if (!this.isPoweredOn) return;
        if (this.elements.rxNeedle) {
          this.elements.rxNeedle.style.transform = `rotate(${this.rxZeroDbAngle()}deg)`;
        }
        if (this.elements.rxLed) {
          this.elements.rxLed.classList.remove('alert-pulse');
          this.elements.rxLed.style.filter = 'brightness(0.8)';
        }
      }, Math.max(0, pulseDurationMs - METER_TRAVEL_MS - RX_ECHO_DELAY_MS));

    }, RX_ECHO_DELAY_MS);
  }

  
  /* Resync both equal-sized channel canvases with their laid-out boxes. */
  syncOscilloscopeRaster() {
    this.txOscGrid = this.syncOscilloscopeChannel(this.elements.txCanvas, this.txCtx);
    this.rxOscGrid = this.syncOscilloscopeChannel(this.elements.rxCanvas, this.rxCtx);
  }

  syncOscilloscopeChannel(canvas, ctx) {
    if (!canvas || !ctx) return null;
    const box = canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, box.width);
    const cssHeight = Math.max(1, box.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rasterWidth = Math.max(1, Math.round(cssWidth * dpr));
    const rasterHeight = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== rasterWidth || canvas.height !== rasterHeight) {
      canvas.width = rasterWidth;
      canvas.height = rasterHeight;
    }
    const scale = rasterWidth / OSC_GRID_WIDTH;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    return {
      width: OSC_GRID_WIDTH,
      height: OSC_GRID_WIDTH * (cssHeight / cssWidth),
      unit: OSC_GRID_WIDTH / cssWidth
    };
  }

  startOscilloscope() {
    this.syncOscilloscopeRaster();
    if (typeof ResizeObserver !== 'undefined') {
      this.scopeResizeObserver = new ResizeObserver(() => this.syncOscilloscopeRaster());
      this.scopeResizeObserver.observe(this.elements.txCanvas);
      this.scopeResizeObserver.observe(this.elements.rxCanvas);
    } else {
      window.addEventListener('resize', () => this.syncOscilloscopeRaster());
    }

    const draw = (timestamp) => {
      requestAnimationFrame(draw);
      if (!this.txCtx || !this.rxCtx || !this.txOscGrid || !this.rxOscGrid) return;

      // Frame-rate independent delta (clamped so a backgrounded tab cannot jump)
      const now = typeof timestamp === 'number' ? timestamp : performance.now();
      const elapsed = this.osLastFrameAt ? Math.min(0.1, (now - this.osLastFrameAt) / 1000) : 0;
      this.osLastFrameAt = now;
      
      this.clearOscilloscopeChannel(this.txCtx, this.txOscGrid);
      this.clearOscilloscopeChannel(this.rxCtx, this.rxOscGrid);
      
      if (!this.isPoweredOn) return;
      
      // Timebase locked to the frequency potentiometer: the sweep scrolls at
      // freqKHz * OSC_SWEEP_LOCK cycles per second, so its speed always follows
      // the tuned carrier and stays perfectly smooth (no frame-rate jitter).
      this.osTime += Math.PI * 2 * this.freqKHz * OSC_SWEEP_LOCK * elapsed;

      // Smoothed burst gate: the edges ease in / out instead of snapping, and the
      // RX wander is low-passed so the trace never flickers frame to frame.
      const txTarget = this.isFiring ? OSC_FIRE_AMP * (this.carrierDutyPct / 50) : OSC_IDLE_AMP;
      this.osTxAmp = this.smoothTowards(this.osTxAmp, txTarget, elapsed, OSC_TX_ATTACK_S);
      const rxTarget = this.isFiring ? this.osTxAmp * 0.5 : OSC_IDLE_RX_AMP;
      this.osRxAmp = this.smoothTowards(this.osRxAmp, rxTarget, elapsed, OSC_RX_ATTACK_S);
      this.osRxNoise = this.smoothTowards(this.osRxNoise, Math.random() * 2 - 1, elapsed, OSC_NOISE_SMOOTH_S);
      const txAmp = this.osTxAmp * (this.txOscGrid.height / OSC_GRID_HEIGHT);
      const rxAmp = (this.osRxAmp + (this.isFiring ? this.osRxNoise * OSC_IDLE_AMP : 0)) * (this.rxOscGrid.height / OSC_GRID_HEIGHT);
      
      // TX and RX render in their own equal-sized, framed channel panels.
      this.drawTrace(this.txCtx, this.txOscGrid, '#00e676', this.osTime, txAmp);
      
      this.drawTrace(this.rxCtx, this.rxOscGrid, '#ffb300', this.osTime + OSC_RX_PHASE_SHIFT, rxAmp);
    };
    draw();
  }

  /* Frame-rate independent exponential easing (bigger time constant = slower) */
  smoothTowards(current, target, elapsedSeconds, timeConstantSeconds) {
    if (elapsedSeconds <= 0) return current;
    const alpha = 1 - Math.exp(-elapsedSeconds / timeConstantSeconds);
    return current + (target - current) * alpha;
  }

  clearOscilloscopeChannel(ctx, grid) {
    ctx.clearRect(0, 0, grid.width, grid.height);
  }

  /* Renders one sine trace on a channel's fixed logical grid. */
  drawTrace(ctx, grid, strokeStyle, phase, amplitude) {
    const { width, height, unit } = grid;
    ctx.beginPath();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2 * unit;
    for (let x = 0; x < width; x++) {
      const y = height / 2 + Math.sin(x * OSC_SPATIAL_K + phase) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  updateUI() {
    if (this.elements.module) {
      this.elements.module.classList.toggle('is-off', !this.isPoweredOn);
      this.elements.module.classList.toggle('is-testing', this.isSelfTesting);
    }
    if (this.elements.statusText) {
      this.elements.statusText.innerText = this.isSelfTesting ? 'SELF-TEST' : '5 - 15 kHz';
    }
    if (this.elements.pillOff && this.elements.pillMan && this.elements.pillAuto) {
      const selectedMode = this.isPoweredOn ? this.mode : 'OFF';
      this.elements.pillMan.disabled = this.isSelfTesting;
      this.elements.pillAuto.disabled = this.isSelfTesting;
      for (const [mode, pill] of [['OFF', this.elements.pillOff], ['MAN', this.elements.pillMan], ['AUTO', this.elements.pillAuto]]) {
        pill.classList.toggle('active', selectedMode === mode);
        pill.setAttribute('aria-pressed', String(selectedMode === mode));
      }
    }

    if (this.elements.btnFire && !this.autoSweepTimer && !this.triggerLoopTimer) {
      this.elements.btnFire.innerText = this.mode === 'AUTO' ? 'START AUTO SWEEP' : 'PULSE FIRE';
    }
    if (this.elements.osTimebase) {
      // Timebase readout proves the horizontal sweep is locked to the carrier
      this.elements.osTimebase.innerText = `TB LOCK: ${this.freqKHz.toFixed(1)} kHz`;
    }
    if (this.elements.btnFire) {
      this.elements.btnFire.disabled = !this.isPoweredOn || this.isSelfTesting;
    }

    if (this.elements.tunerNeedle && !this.isSelfTesting) {
      const percentage = ((this.freqKHz - 5.0) / 10.0) * 90 + 5;
      this.elements.tunerNeedle.style.left = `${percentage}%`;
    }
    if (this.elements.tunerWindow) {
      this.elements.tunerWindow.setAttribute('aria-valuenow', this.freqKHz.toFixed(1));
      this.elements.tunerWindow.setAttribute('aria-valuetext', `${this.freqKHz.toFixed(1)} kHz`);
      this.elements.tunerWindow.setAttribute('aria-valuestep', this.freqStepKHz.toFixed(1));
      this.elements.tunerWindow.setAttribute('aria-disabled', String(!this.isPoweredOn || this.isSelfTesting || this.mode !== 'MAN'));
      this.elements.tunerWindow.style.cursor = this.isPoweredOn && this.mode === 'MAN' ? 'ew-resize' : 'not-allowed';
    }

    if (this.elements.knobFreq) {
      const angle = -135 + ((this.freqKHz - 5.0) / 10.0) * 270;
      if (!this.isSelfTesting) this.elements.knobFreq.style.transform = `rotate(${angle}deg)`;
      this.elements.knobFreq.style.cursor = this.isPoweredOn && this.mode === 'MAN' ? 'ns-resize' : 'not-allowed';
      this.elements.knobFreq.setAttribute('aria-disabled', String(!this.isPoweredOn || this.isSelfTesting || this.mode !== 'MAN'));
      this.elements.knobFreq.setAttribute('aria-valuestep', this.freqStepKHz.toFixed(1));
      this.elements.knobFreq.setAttribute('aria-valuenow', this.freqKHz.toFixed(1));
      this.elements.knobFreq.setAttribute('aria-valuetext', `${this.freqKHz.toFixed(1)} kHz`);
    }
    if (this.elements.knobStep) {
      const position = (this.freqStepKHz - 0.1) / 1.9;
      const angle = -135 + position * 270;
      if (!this.isSelfTesting) this.elements.knobStep.style.transform = `rotate(${angle}deg)`;
      this.elements.knobStep.setAttribute('aria-disabled', String(!this.isPoweredOn || this.isSelfTesting));
      this.elements.knobStep.setAttribute('aria-valuestep', '0.1');
      this.elements.knobStep.setAttribute('aria-valuenow', this.freqStepKHz.toFixed(1));
      this.elements.knobStep.setAttribute('aria-valuetext', `${this.freqStepKHz.toFixed(1)} kHz`);
    }
    if (this.elements.knobCarrierDuty) {
      const position = (this.carrierDutyPct - 10) / 80;
      const angle = -135 + position * 270;
      if (!this.isSelfTesting) this.elements.knobCarrierDuty.style.transform = `rotate(${angle}deg)`;
      this.elements.knobCarrierDuty.setAttribute('aria-disabled', String(!this.isPoweredOn || this.isSelfTesting));
      this.elements.knobCarrierDuty.setAttribute('aria-valuestep', '1');
      this.elements.knobCarrierDuty.setAttribute('aria-valuenow', String(this.carrierDutyPct));
      this.elements.knobCarrierDuty.setAttribute('aria-valuetext', `${this.carrierDutyPct} percent`);
    }
    if (this.elements.knobBurstDuty) {
      const position = (this.burstDutyPct - 40) / 40;
      const angle = -135 + position * 270;
      if (!this.isSelfTesting) this.elements.knobBurstDuty.style.transform = `rotate(${angle}deg)`;
      this.elements.knobBurstDuty.setAttribute('aria-disabled', String(!this.isPoweredOn || this.isSelfTesting));
      this.elements.knobBurstDuty.setAttribute('aria-valuestep', '1');
      this.elements.knobBurstDuty.setAttribute('aria-valuenow', String(this.burstDutyPct));
      this.elements.knobBurstDuty.setAttribute('aria-valuetext', `${this.burstDutyPct} percent`);
    }

    
    if (this.elements.knobAudio) {
      const angle = -135 + (this.audioMode / 3) * 270;
      if (!this.isSelfTesting) this.elements.knobAudio.style.transform = `rotate(${angle}deg)`;
      this.elements.knobAudio.setAttribute('aria-valuenow', String(this.audioMode));
      this.elements.knobAudio.setAttribute('aria-valuetext', AUDIO_MODE_LABELS[this.audioMode]);
    }

    if (this.elements.labelFreq && !this.isSelfTesting) {
      this.elements.labelFreq.innerText = `${this.freqKHz.toFixed(1)} kHz`;
    }
    if (this.elements.labelStep && !this.isSelfTesting) {
      this.elements.labelStep.innerText = `STEP: ${this.freqStepKHz.toFixed(1)} kHz`;
    }
    if (this.elements.labelCarrierDuty && !this.isSelfTesting) {
      this.elements.labelCarrierDuty.innerText = `CARRIER: ${this.carrierDutyPct}%`;
    }
    if (this.elements.labelBurstDuty && !this.isSelfTesting) {
      this.elements.labelBurstDuty.innerText = `BURST: ${this.burstDutyPct}%`;
    }
  }
}
