فلزیاب UAV ‑ طراحی کامل (Hardware + Software)

هدف: ساخت یک زیرسیستم فرستنده / گیرنده (TX / RX) برای تشخیص فلز با استفاده از یک کویل، رزبری‌پای 5، و یک سرور Go که داده‌ها را به یک صفحه وب مانیتورینگ بر‑سروش می‌دهد.
محدودیت‌ها: قابل ساخت در یک آزمایشگاه خانگی، وزن و قدرت مناسب برای نصب روی پهپاد (Pixhawk 6C).
رویکرد: استفاده از معماری پالسی‑اندیکس (Pulse‑Induction PI) با اندازه‌گیری آمplitude + فاز سیگنال‌ بازگشتی برای استخراج عمق هدف (مثلاً گوی ۵ cm در عمق 30 cm).

1️⃣ نمای کلی سیستم
+-------------------+        +-------------------+        +-----------------------+
|   Pixhawk 6C      |<------>|   Power‑Distribution   |<---->|  Battery Packs (LiPo) |
| (flight control) |  I²C  |  (isolated rails)  |  DC   +-----------------------+
|                   |        +-------------------+        |   – 5 V (Pi, ADC)   |
+-------------------+        |   – 12 V (Coil driver)    +-----------------------+
           ^                                     ^      +-------------------+
           |                                     |      |   Raspberry|
           |                                     |      |   Pi 5    |
           |                               +-----------+
           |                               |  Go‑Server (Pi) |
           |                               +-------------------+
           |                                      |
   +------------------+           WebSocket   +-------------------+
   |   Ground‑Station |<---------------------->|  Go‑Server (Pi) |
   |  (browser)      |  (JSON over WS)        +-------------------+
   +------------------+                               |
                                                      |
                                            +-------------------+
                                            |   TX / RX Board   |
                                            |   (Coil driver)   |
                                            +-------------------+
                                                    |
                                                    |  ⇆  Coil (LC‑tuned)
                                                    v
                                                +--------+
                                                |  Coil  |
                                                +--------+
Coil – یک‌سیم (single‑coil) پالسی‑اندیکس.
TX / RX Board – مدار سوئیچینگ MOSFET با یک‌طرفه‌خوانی و یک ADC برای نمونه‌برداری از رینگ‑داون.
Raspberry Pi 5 – اجرا کنندهٔ سرور Go، تولید PWM (متغیر 5‑15 kHz) از طریق PCA9685 (I²C, 12‑bit PWM) یا مستقیم‑GPIO‑PWM.
Ground‑Station – صفحهٔ وب ساده (HTML + JS) با WebSocket برای نمایش زمان‑تا‑پیک، آمپلیتود، محاسبهٔ عمق.
2️⃣ انتخاب قطعات کلیدی
بخش	جزء پیشنهادی	دلیل انتخاب	نکات عملی
Coil	سیم ‎AWG 30 (≈ 0.25 mm) روی هستهٔ فریت 5 cm Ø، 8‑12 دور، L ≈ 220 µH, R ≈ 5 Ω	قطر مناسب برای نصب روی بدنهٔ UAV، اندوکتانس کافی برای تنظیم 5‑15 kHz با خازن‌های تنظیمی.	می‌توانید با تست مقدار اندوکتانس را با LCR‑Meter تنظیم کنید.
Driver MOSFET	IRF5305 (N‑Channel, V DS = 100 V, R_DS(on) ≈ 0.16 Ω) یا CSD18537 (SiC, سرعت سوئیچ بالا)	سوئیچینگ سریع تا 15 kHz، تحمل جریان ≤ 3 A (پیشنهاد برای 5 V‑12 V).	درگاه درایور (gate) با مقاومت 100 Ω + Pull‑Down 10 kΩ برای اطمینان از خاموشی.
Gate‑Driver	TC4420 (dual MOSFET driver, 6 V‑18 V)	تامین لبه‌های سریع PWM، جلوگیری از بردگی در MOSFET.	
ADC	ADS1115 (16‑bit, ±6.144 V, I²C)	نمونه‌برداری تک‌کاناله برای رینگ‑داون؛ نرخ نمونه‌برداری تا 860 S/s (کافی برای 15 kHz).	
PWM Generator	PCA9685 (12‑bit, 24‑bit I²C PWM) یا GPIO‑PWM رزبری Pi (hardware PWM روی GPIO12/13)	امکان تنظیم دقیق فرکانس 5‑15 kHz؛ اگر از PCA9685 استفاده کنید، می‌توانید چندین کانال (TX, RX, LED) داشته باشید.	
Power Isolation	DC‑DC Buck 5 V 3 A برای Pi & ADC، Buck 12 V 2 A برای driver MOSFET	جداسازی ریل‌های نیرو؛ هر ریل یک فیوز 500 mA (Pi) – 1 A (driver) دارد.	
دستگاه ارتباطی	WebSocket بر بستر Go (gorilla/websocket)	تاخیر بسیار کم، دو‑طرفه، مناسب برای مانیتورینگ زنده.	
انبار داده	NVMe SSD برای رزبری Pi (OS + Go binaries)	سرعت بالا، کاهش تاخیر I/O.	
Battery	دو بسته LiPo 4S 5000 mAh (12 V) – یکی برای موتورهای پروازی (Pixhawk) و دیگری اختصاصی برای کویل/موبایل	جداسازی به‑منظور کاهش نویز الکترومغناطیسی بر روی حسگر.	
پروتکل ارتباط	UART (Pi ↔ Pixhawk) یا CAN (اگر Pixhawk‑6C آن را فراهم می‌کند) برای هماهنگی پروازی	استفاده از MAVLink برای دریافت وضعیت پرواز (ارتفاع، سرعت) به‌منظور ترکیب داده‌های حسگر.	
3️⃣ محاسبهٔ LC‑تناسق (تعدیل باند فرکانسی)

برای پوشش 5 kHz – 15 kHz می‌توان از یک شبکه تنظیمی متغیر (VARACTOR) استفاده کرد:

𝑓
0
=
1
2
𝜋
𝐿
𝐶
f
0
	​

=
2π
LC
	​

1
	​

هدف (kHz)	مقدار C مورد نیاز (nF) (با L ≈ 220 µH)
5	 ≈ 23 nF
10	 ≈ 5.8 nF
15	 ≈ 2.6 nF

راه‌حل عملی:
استفاده از یک capacitor bank (10 nF + 4.7 nF + 2.2 nF) به‌صورت سوئیچ‌پذیر (MOSFET یا reed‑relay) که توسط Pi کنترل می‌شود. این امکان می‌دهد باند فرکانسی را در حین پرواز تغییر بدهید.

4️⃣ طراحی مدار TX / RX (یک صفحه PCB)
4.1 بلوک‌های اصلی
Gate‑Driver (TC4420) + MOSFET (IRF5305)
دورهٔ تنظیمی (Capacitor Bank)
ADC (ADS1115) + فیلترهای حذف نویز (RC ≈ 10 kΩ – 100 nF)
سطح‌کاهش ولتاژ (Voltage Divider) برای مقایسه با ADC
پاور‑Isolation (Fuses, Diodes, Buck‑Regulators)
Connector برای Coil (2‑پین شیلد)
Header I²C (SDA/SCL) برای ADC + PCA9685
پین‌های کنترل GPIO (Gate‑Enable, Cap‑Select)
4.2 شماتیک (مرکب)
+12V ----+---[Fuse 1A]---+---+--- Buck→5V (Pi)  
         |               |   |
         |               |   +----+---+  (Vin MOSFET Gate)  
         |               |        | TC4420 |--- Gate → MOSFET  
         |               |        +--------+  
         |               |          |  
         |               |          +---+---- Coil  (one‑wire)  
         |               |          |   |
         |               |          |   +--- Cap‑Bank (C1‑C3) ↔ Pi (select)  
         |               |          |       
         |               |          +---+--- ADS1115 (V+ via voltage divider)  
         |               +----------------+--- I²C (SDA / SCL) → Pi
         |
        GND (common) ----------------------- all grounds

توجه: تمام زمین‌ها (Pi, ADC, driver) به‌صورت star‑ground به یک نقطهٔ جداگانه (پین GND اصلی PCB) متصل شوند تا نویز کمینه شود.

4.3 PCB Layout نکات
نکته	توضیح
مسیرهای قدرت: مسیرهای 12 V → MOSFET باید از لایهٔ سیگنال جدا باشند (۱۰ mil ≥ 2 layer).	
زمین‌های حساس: مساحت پلین GND بزرگ (≥ 2 cm²); استفاده از via‑stitching برای اتصال لایه‌های زمین.	
دورهای کویل: نزدیکی به PCB حداکثر ۲ mm; از لایهٔ بالایی برای مسیرهای قوی (تقریباً 50 mil) استفاده کنید.	
فیلترهای ورودی ADC: RC 10 kΩ – 100 nF برای حذف نوف‌پیک‌های سوئیچینگ.	
کابل‌های کویل: استفاده از کابل دو‌سیم شیلد (shielded) با گره‌زنی (twisted) برای کاهش EM‑I.	
5️⃣ نرم‌افزار – سرور Go
5.1 ساختار کلی
/cmd
 └─ server/main.go          // entry‑point
/internal
 ├─ pwm/
 │   └─ pwm.go              // کنترل PCA9685 (or hardware PWM)
 ├─ adc/
 │   └─ adc.go              // خواندن ADS1115
 ├─ coil/
 │   └─ coil.go             // تنظیم باند (Cap‑Select) + فعال‑غیرفعال
 ├─ ws/
 │   └─ hub.go              // WebSocket hub (broadcast)
 ├─ signal/
 │   └─ process.go          // FFT / Zero‑Cross / Phase extraction
 └─ config/
     └─ config.go           // پارامترهای runtime (freq range, sample rate)
5.2 الگوریتم پردازش سیگنال
GeneratePulse(freq, duty) – PWM به‌صورت تک‑پالس (مثلاً 10 µs) در فرکانس هدف.
RecordRingDown() – ADC 16‑bit نمونه‌برداری به‌صورت Burst (≈ 2 ms) پس از هر پالس.
ExtractFeatures()
Amplitude – حداکثر مقدار نمونه (بعد از اعمال High‑Pass 500 Hz).
Zero‑Cross Timing – زمان تا اولین عبور از صفر بعد از پیک؛ تخمین فاز.
FFT (optional) – برای استخراج انرژی در باندهای فرکانسی متعدد.
Depth Estimation – از رابطهٔ تجربی:

𝑑
≈
𝑘
×
1
Amplitude
×
sin
⁡
(
𝜙
)
d≈k×
Amplitude
1
	​

×sin(ϕ)
(k ≈ calibration constant, φ = phase).
مقادیر k با تست گوی ۵ cm در عمق‌های مختلف (۱۰ cm‑۴۰ cm) به‌دست می‌آیند.
5.3 API WebSocket (JSON)
پیام	سمت	محتوا
status	Server → Client	{ "cpu":12.5, "temp":45.2 }
pulse	Client → Server	{ "freq":12000, "duty":0.1 }
sample	Server → Client	{ "amp":0.023, "phase":0.87, "depth":0.31 }
error	Server → Client	{ "msg":"ADC timeout" }
5.4 نحوه اجرا
bash
# روی Pi5
sudo apt update && sudo apt install -y git build-essential
git clone https://github.com/yourname/drone‑metal‑detector.git
cd drone‑metal‑detector
go build ./cmd/server
sudo ./server   # اجرا به‌صورت systemd service توصیه می‌شود

(فایل systemd/drone-detector.service در بخش Artifact موجود است.)

6️⃣ Ground‑Station (HTML + JS)
html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Drone Metal Detector</title>
  <style>
    body{font-family:Arial,Helvetica;margin:2rem;}
    #log{max-height:300px;overflow:auto;background:#f4f4f4;padding:0.5rem;}
  </style>
</head>
<body>
  <h1>Metal Detector Dashboard</h1>
  <label>Frequency (kHz):
    <input type="range" id="freq" min="5" max="15" step="0.5" value="10">
    <span id="freqVal">10</span>
  </label>
  <button id="start">Start</button>
  <button id="stop" disabled>Stop</button>
  <pre id="log"></pre>
  <script>
    const ws = new WebSocket('ws://' + location.host + '/ws');
    const log = document.getElementById('log');
    const freq = document.getElementById('freq');
    const freqVal = document.getElementById('freqVal');
    const startBtn = document.getElementById('start');
    const stopBtn = document.getElementById('stop');
    freq.oninput = () => freqVal.textContent = freq.value;
    ws.onmessage = ev => {
      const data = JSON.parse(ev.data);
      if(data.amp!==undefined){
        log.textContent += `⏱ ${new Date().toLocaleTimeString()} | Amp: ${data.amp.toFixed(4)} V | Phase: ${data.phase.toFixed(3)} rad | Depth: ${(data.depth*100).toFixed(1)} cm\n`;
        log.scrollTop = log.scrollHeight;
      }
    };
    startBtn.onclick = () => {
      ws.send(JSON.stringify({cmd:'pulse', freq:parseFloat(freq.value)*1000}));
      startBtn.disabled = true; stopBtn.disabled = false;
    };
    stopBtn.onclick = () => {
      ws.send(JSON.stringify({cmd:'stop'}));
      startBtn.disabled = false; stopBtn.disabled = true;
    };
  </script>
</body>
</html>
فایلی به نام static/index.html در پوشهٔ سرور Go قرار می‌گیرد.
برای HTTPS می‌توانید از nginx یا caddy به‌عنوان reverse‑proxy استفاده کنید (اختیاری).
7️⃣ مدیریت انرژی – جداسازی باتری‌ها
منبع	ولتاژ	جریان مصرف‑حداکثر	پیشنهاد باتری	جداسازی
Pi 5 + ADC + MCU	5 V	1.5 A (Pi) + 0.2 A (ADC)	1× LiPo 4S 5000 mAh → Buck 5 V	هم‌راستا با سایر سرویس‌های پردازشی (MAVLink)
Coil Driver	12 V (MOSFET)	2 A (پیک)	1× LiPo 4S 5000 mAh مستقل	جداسازی کامل برای کاهش نویز EM
Motors / Pixhawk	12 V (یا 22.2 V بسته به پرواز)	متغیر (10 A+)	باتری اصلی UAV (پیشنهاد 4S‑6S)	مجزا (به‌صورت مستقیم به ESC)

مزایای جداسازی:

کاهش نویز الکترومغناطیسی در مسیر ADC.
پایداری ولتاژ برای کویل (بدون درگیر شدن با تغییرات بار موتور).
امکان خاموش/روشن کردن جداگانه بخشی از سیستم در حین پرواز (مثلاً فقط در "Scan Mode").
8️⃣ کالیبراسیون و تست
کالیبره‌کردن کویل
در حالت استاتیک (بدون UAV)، با استفاده از یک مولتی‌متر فرکانس‌سنج یک‌پالس 10 kHz‑15 kHz تولید کنید و مقدار L را با LCR‑Meter تأیید کنید.
پروفایل رینگ‑داون
گوی مسی ۵ cm، عمق ۱۰ cm، ۲۰ cm، … ۴۰ cm را در خاک شنی قرار دهید. برای هر عمق ۱۰‑بار اندازه‌گیری کنید و رابطهٔ Amplitude ↔ Depth را استخراج کنید.
تنظیم فاز
با استفاده از روش Zero‑Cross زمان تا عبور از صفر بعد از پیک را محاسبه کنید؛ سپس با یک معادلهٔ خطی (یا چندجمله‌ای) تبدیل به عمق کنید.
حساسیت به نویز
موتورهای UAV را به‌صورت همزمان فعال کنید؛ مقدار SNR را با/بدون فیلترهای دیجیتال (IIR low‑pass 2 kHz) مقایسه کنید.
آزمایش در پرواز
Drone را در ارتفاع ثابت (مثلاً 3 m) نگه دارید؛ به‌صورت متناوب بپرسید آیا تغییرات عمق (مثلاً جسم زیر UAV) مشاهده می‌شود.

نتیجه‌گیری: پس از جمع‌آوری داده‌های کالیبراسیون، ضریب k در فرمول عمق را در فایل config/calibration.yaml ذخیره کنید.

9️⃣ فهرست قطعات (Bill of Materials)
#	قطعه	مقدار	لینک نمونه (digikey / mouser)
1	Raspberry Pi 5 8 GB	1	https://www.raspberrypi.org/products/raspberry-pi-5/

2	NVMe SSD 250 GB (M.2)	1	https://www.samsung.com/semiconductor/minisite/ssd/

3	LiPo 4S 5000 mAh (12 V)	2 (یکی برای Pi+ADC، دیگری برای Coil)	https://www.tenergy.com

4	Buck‑Reg 5 V 3 A	1	https://www.pololu.com

5	MOSFET IRF5305 (N‑CH)	1	https://www.infineon.com

6	Gate‑Driver TC4420	1	https://www.ti.com

7	ADC ADS1115 (breakout)	1	https://www.adafruit.com

8	PWM driver PCA9685 (I²C)	1	https://www.nxp.com

9	Capacitor bank (10 nF, 4.7 nF, 2.2 nF, 0.1 µF)	4	http://www.murata.com

10	سیم AWG 30 (2 m)	1 رول	https://www.digikey.com

11	هسته فریت Ø 5 cm, ارتفاع 2 cm	1	http://www.murata.com

12	PCB protoboard 2 × 4 in (FR‑4)	1	https://www.jlcpcb.com

13	فیوز 1 A (لید)	2	https://www.littelfuse.com

14	کانکتورهای JST‑PH 2‑pin (Coil)	1	https://www.molex.com

نکته: تمام قطعات می‌توانند به‌صورت آنلاین (Digikey / Mouser / JLCPCB) سفارش داده شوند. هزینه تقریباً $120‑150 (بدون هزینه پرینت PCB) که در «بدون محدودیت بودجه» جای می‌گیرد.

🔟 مراحل مونتاژ (Step‑by‑Step)
طراحی PCB – با KiCad یا EasyEDA طرح مدار بالا را رسم کنید؛ لایهٔ قدرت را با 2 oz copper، لایهٔ سیگنال با 1 oz.
نقشه سطوح (Footprints) – درج MC‑PCA9685، ADS1115، TC4420، IRF5305، هدرهای I²C.
سخت‌افزار
لحیم‌کاری MOSFET + Gate‑Driver.
نصب فیلترهای RC بین MOSFET و Coil.
اتصال Capacitor Bank به پین‌های GPIO (بسته به انتخاب فرکانس).
اتصال ADS1115 به I²C bus (SDA → GPIO 2، SCL → GPIO 3).
اتصال PCA9685 به همان I²C bus.
نصب Coil – سیم AWG 30 را به‌صورت 10‑12 دور دور هسته فریت بپیچید؛ انتهاهای سیم را به یک کانکتور JST‑PH متصل کنید.
پاور – هر ریل (5 V, 12 V) به‌صورت جداگانه از LiPo‌ها عبور دهید؛ به هر ریل یک فیوز در خط مثبت قرار دهید.
نصب Pi 5 – SSD را در اسلات M.2 جای‌گذاری کنید، OS (Ubuntu 22.04 LTS) نصب کنید، سپس بسته‌های Go / I²C‑tools را نصب کنید.
نصب نرم‌افزار – کلون ریپازیتوری، ساخت باینری، ثبت سرویس systemd.
راه‌اندازی Ground‑Station – فایل static/index.html را در /var/www/html/ یا در پوشهٔ embed Go قرار دهید.
کالیبراسیون – گام‌های 8‑10 بخش کالیبراسیون را انجام دهید و مقادیر را در config/calibration.yaml بنویسید.
تست پیش‌نهایی – در حالت ثابت (بدون پرواز) فرکانس را بین 5‑15 kHz تغییر دهید، رینگ‑داون را مشاهده کنید؛ سپس UAV را روشن کنید و آزمایش پروازی انجام دهید.
📚 منابع آموزشی (Links)
موضوع	منبع
Pulse‑Induction Metal Detection	https://www.ti.com/lit/an/sloa066/sloa066.pdf

طراحی مدار MOSFET سوئیچینگ	https://www.eevblog.com/forum/beginners/mosfet-switching-basics/

استفاده از PCA9685 با Go	https://github.com/kidoman/embd/tree/master/driver/pca9685

WebSocket در Go (gorilla)	https://github.com/gorilla/websocket

ADS1115 I²C driver (Go)	https://github.com/d2r2/go-i2c

KiCad PCB design tutorial	https://kicad.org/tutorials/
📦 Artifact (Full Markdown Design)

فایل:
/Users/taha/.gemini/antigravity/brain/c8e6d7d7-00e9-4791-a673-2aeabf2bd73a/Drone_Metal_Detector_Design.md

🎯 قدم بعدی
تایید طرح – اگر بخشی از مشخصات (مثلاً تعداد دورهای کویل یا ولتاژ منبع) را می‌خواهید تغییر دهید، بگویید.
درخواست فایل‌های KiCad – می‌توانم یک پروژه KiCad اولیه (schematic + PCB) را در قالب یک آرشیو .zip بسازم.
آموزش نصب Go server – اگر نیاز به اسکریپت استارت‑اپ یا systemd service دارید، بفرمایید.

منتظر نظرات شما هستم! 🚀