# Hardware Specification Document: High-Frequency Inductive Coil Transmitter Architecture (TX-HD-01)

## 1. Document Control & Scope
* **Document ID:** HW-SPEC-TX-COIL-DRV-REV01
* **System Architecture:** Dual-Domain Isolated Power & Logic Architecture
* **Target Application:** High-Power Switching Inductive Coil Systems
* **Classification:** Proprietary / Industrial Embedded Design

---

## 2. System Architecture & Domain Isolation
The hardware topology implements strict galvanic and logical separation to prevent high-frequency switching transients and power rail noise from propagating into the processing core:
* **Control Domain (Logic Layer):** Powered by an ultra-low-noise regulated rail ($3.3\text{V}$), housing the primary microcontroller and communication interfaces.
* **Power Domain (Switching Layer):** Powered by an isolated high-current rail ($12\text{V}/24\text{V}$), dedicated to gate drivers, power MOSFETs, and inductive coil discharge management.

---

## 3. Microcontroller Core Subsystem
* **Processor Unit:** **STM32G431CBT6** (Package: LQFP-48)
* **Architectural Justification:** Selected for its high-resolution hardware timers (HRTIM / Advanced Control Timers) capable of nanosecond-accurate PWM generation, high-speed analog-to-digital converters (ADCs), and an ARM Cortex-M4 core featuring a Floating Point Unit (FPU) for real-time telemetry processing.

---

## 4. Power Regulation, Decoupling & Reset Topologies
* **Logic Voltage Regulator:** Ultra-low dropout (LDO), low-noise regulator **TPS7A2033** providing a stable $3.3\text{V}$ rail for the core logic.
* **Decoupling Network:** Multi-layer ceramic capacitors (MLCC, $100\text{nF}$) placed directly adjacent to every VDD/VDDA pin, paired in parallel with bulk tantalum capacitors ($10\mu\text{F}$) for wide-band transient suppression.
* **Hardware Reset Circuitry (NRST):** 
  * Pull-up resistor ($10\text{k}\Omega$) tied to the $3.3\text{V}$ rail.
  * Shunt filtering capacitor ($100\text{nF}$) tied to Logic Ground (GND).
  * Function: Ensures deterministic MCU boot-up behavior and immunity against electromagnetic interference (EMI) induced spurious resets.

---

## 5. Interface Protection & Galvanic Isolation
* **Electrostatic Discharge (ESD) Protection:** High-speed rail clamping diode array **USBLC6-2SC6** positioned at interface boundaries to suppress transient voltage spikes.
* **Galvanic Isolation Barrier:** High-speed quad digital isolator **ISO7741** providing absolute galvanic separation between external host controllers (e.g., Single Board Computers) and the TX board control logic, eliminating ground loops.

---

## 6. Power Stage, Gate Drive & Switching Topologies
* **Power Rail:** Dedicated isolated high-current rail ($12\text{V}/24\text{V}$) servicing the inductive load.
* **Bulk Power Filtering:** Low-ESR electrolytic capacitor bank situated at the power entry node to absorb high di/dt transient current spikes.
* **Power Switches:** Low on-state resistance ($R_{DS(on)}$) N-Channel power MOSFETs model **BSC090N03LS** configured in complementary push-pull topology.
* **Snubber & Flywheel Network:** Fast recovery freewheeling diodes (**STTH1L06**) combined with gate resistors, pull-down networks, and RC snubber circuits designed to dissipate stored magnetic energy (Back EMF) during commutation.
* **Thermal Management:** Centralized thermal mounting of power switches onto an extruded aluminum heatsink coupled with electrically isolating silicone thermal pads.

---

## 7. Telemetry, Sensing & Overcurrent Protection Subsystems
* **Thermal Monitoring:** Precision linear active-pin temperature sensor **TMP36** (TO-92 package) thermally bonded via thermal paste to the MOSFET heatsink, feeding analog thermal metrics directly to an MCU ADC channel for thermal shutdown logic.
* **Isolated Current Sensing & Overcurrent Protection (OCP):**
  * **Shunt Resistor:** Low-ohm ($1\,\text{m}\Omega$), high-power precision shunt resistor integrated into the power return path.
  * **Isolated Amplifier:** High-precision capacitive-isolation differential amplifier **AMC1311**. It measures the differential voltage drop across the shunt resistor in the high-voltage power domain ($12\text{V}$), bridges the isolation barrier, and outputs a scaled, isolated analog voltage to the MCU ADC ($3.3\text{V}$ domain) for instantaneous software/hardware overcurrent trip execution.

---

## 8. Comprehensive I/O Signal Pinout Matrix

| Pin Index | Signal Identifier | Origin / Destination Subsystem | Signal Classification | Functional Engineering Description |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `VDD_3V3` | LDO Regulator to MCU VDD | Power (Input) | Regulated low-noise $3.3\text{V}$ supply rail for core logic |
| **2** | `GND` | System Logic Ground Reference | Reference | Common ground for control domain |
| **3** | `NRST` | Hardware Reset Network | Control (Input) | Active-low microcontroller master reset line with RC filter |
| **4** | `TX_CMD_IN` | External Host (via ISO7741) | Digital (Input) | Real-time command stream and switching trigger pulses |
| **5** | `TX_TEL_OUT` | External Host (via ISO7741) | Digital (Output) | System status, fault flags, and diagnostic telemetry stream |
| **6** | `PWM_MOSFET_1` | MCU Timer to Gate Driver 1 | Digital (Output) | Primary complementary switching pulse (with enforced dead-time) |
| **7** | `PWM_MOSFET_2` | MCU Timer to Gate Driver 2 | Digital (Output) | Secondary complementary switching pulse |
| **8** | `TEMP_SENSE` | TMP36 Heatsink Sensor Output | Analog (MCU ADC Input) | Continuous thermal telemetry channel |
| **9** | `CURR_SENSE` | AMC1311 Isolated Output Stage | Analog (MCU ADC Input) | Real-time load current feedback for OCP execution |