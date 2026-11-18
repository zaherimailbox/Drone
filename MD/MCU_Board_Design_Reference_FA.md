# مستند مرجع طراحی برد MCU

## پروژه Pulse-Induction / PI --- Raspberry Pi 5 + STM32H743VIT6

## 1. هدف برد MCU

برد MCU واسط هوشمند بین Raspberry Pi 5 و دو برد اختصاصی TX و RX است.

وظایف اصلی:

1.  دریافت فرمان‌ها و تنظیمات از Raspberry Pi.
2.  ارتباط سریع SPI با Raspberry Pi.
3.  ارتباط UART برای Debug / Service / Configuration.
4.  تولید دقیق پالس TX با Timer سخت‌افزاری.
5.  تولید زمان‌بندی RX Blank / Trigger / Enable.
6.  دریافت وضعیت TX و RX.
7.  خواندن دما و ولتاژهای مانیتورینگ.
8.  دریافت سیگنال آنالوگ RX.
9.  اجرای الگوریتم‌های پردازش اولیه و آماده‌سازی داده.
10. ارسال داده‌های اندازه‌گیری‌شده به Raspberry Pi.
11. فراهم کردن SWD برای پروگرام و Debug.
12. فراهم کردن Test Point برای توسعه و عیب‌یابی.

------------------------------------------------------------------------

# 2. معماری کلی

``` text
                         Raspberry Pi 5
                              |
                         J1 / 12 Pin
                              |
                +-------------+-------------+
                |       MCU BOARD            |
                |                             |
                |   Power / Clock / Reset     |
                |             |               |
                |       STM32H743VIT6         |
                |        |    |    |          |
                |       SPI  UART TIMER ADC   |
                |        |         |           |
                +--------+---------+-----------+
                         |         |
                       J2|         |J3
                         |         |
                    +----+----+ +--+-----+
                    | TX BOARD| | RX BOARD|
                    +---------+ +---------+
```

**اصل مهم:** 3.3V و GND این کابل‌ها فقط مرجع و تغذیه منطقی هستند. تغذیه
توان TX و جریان کویل از این مسیر عبور نمی‌کند.

------------------------------------------------------------------------

# 3. بلوک‌های برد MCU

  بلوک   نام                    وظیفه
  ------ ---------------------- ---------------------------------
  B1     MCU Core               اجرای Firmware و کنترل کل سیستم
  B2     Logic Power            تغذیه 3.3V منطقی MCU
  B3     Analog Power           تغذیه تمیز VDDA/VREF
  B4     HSE Clock              ایجاد مرجع کلاک پایدار
  B5     Reset / Boot           Reset و انتخاب حالت Boot
  B6     SWD                    پروگرام و Debug
  B7     Raspberry Pi Gateway   SPI + UART + IRQ
  B8     TX Interface           فرمان و مانیتورینگ TX
  B9     RX Interface           فرمان و دریافت داده RX
  B10    ADC Monitoring         دما، ولتاژ و Sense
  B11    Test Points            اندازه‌گیری و توسعه
  B12    Expansion              رزرو GPIO برای آینده

------------------------------------------------------------------------

# 4. فهرست قطعات اصلی

## 4.1 قطعات فعال

  Ref   قطعه                          تعداد بلوک   وظیفه
  ----- --------------------------- ------- ------ --------------------
  U1    STM32H743VIT6                     1 B1     MCU اصلی
  J1    کانکتور JST قفل‌دار 12 پین         1 B7     Raspberry Pi ↔ MCU
  J2    کانکتور JST قفل‌دار 12 پین         1 B8     MCU ↔ TX
  J3    کانکتور JST قفل‌دار 12 پین         1 B9     MCU ↔ RX
  J4    کانکتور SWD شش‌پین                 1 B6     پروگرام/Debug
  SW1   Push Button                       1 B5     Reset دستی
  JP1   Jumper                            1 B5     انتخاب BOOT0

------------------------------------------------------------------------

## 4.2 مقاومت‌ها

  Ref     مقدار اولیه بلوک     وظیفه
  ----- ------------- -------- ---------------------------------
  R1             10kΩ B5       Pull-up برای NRST
  R2              1kΩ B5       محدودکردن مسیر Reset از Pi
  R3            100kΩ B5       Pull-down برای BOOT0
  R7            33Ω\* B7       Series resistor برای MOSI
  R8            33Ω\* B7       Series resistor برای MISO
  R9            33Ω\* B7       Series resistor برای SCLK
  R10           33Ω\* B7       Series resistor برای CS
  R11           33Ω\* B7       Series resistor برای DATA_READY
  R12           33Ω\* B7       Series resistor برای SYNC/IRQ
  R13           33Ω\* B7       Series resistor UART_TX
  R14           33Ω\* B7       Series resistor UART_RX
  R15           33Ω\* B7       Reserve / signal conditioning
  R16             TBD B10      مقیاس/فیلتر TX_SENSE
  R17             TBD B10      تقسیم ولتاژ TX_VMON
  R18             TBD B10      تقسیم/حفاظت RX_VMON
  R19             TBD B10      فیلتر TX_TEMP
  R20             TBD B10      فیلتر RX_TEMP
  R21             TBD B10      فیلتر RX_SIGNAL
  R22             TBD B8/B10   Reserve analog
  R23           100kΩ B5       BOOT0 Pull-down

\* مقدار 33Ω مقدار شروع طراحی است و بعد از بررسی طول کابل و Signal
Integrity می‌تواند 0Ω یا مقدار دیگری شود.

------------------------------------------------------------------------

# 5. خازن‌ها

  Ref       مقدار اولیه بلوک   وظیفه
  ------- ------------- ------ -----------------------
  C1-C5           100nF B2     Decoupling هر VDD
  C6               10µF B2     Bulk local decoupling
  C7              100nF B5     فیلتر NRST
  C8              100nF B1     VBAT decoupling
  C9                TBD B4     HSE load capacitor
  C10               TBD B4     HSE load capacitor
  C11               TBD B10    فیلتر RX_VMON
  C12               TBD B10    فیلتر RX_SIGNAL
  C13               TBD B10    فیلتر TX_TEMP
  C14               TBD B10    فیلتر TX_VMON
  C15             100nF B3     VREF+ decoupling
  C16               1µF B3     VREF+ bulk
  C17               1µF B3     VDDA bulk
  C18             100nF B3     VDDA HF decoupling
  C19               TBD B10    فیلتر TX_SENSE
  C20               TBD B10    فیلتر RX_TEMP
  C21             2.2µF B1     VCAP1
  C22             2.2µF B1     VCAP2
  C23             100nF B2     VDD100 decoupling

**مقادیر TBD باید پس از مشخص‌شدن قطعه واقعی، محدوده ولتاژ و فرکانس سیگنال
نهایی شوند.**

------------------------------------------------------------------------

# 6. قطعات تغذیه

  Ref         قطعه           بلوک   وظیفه
  ----------- -------------- ------ ------------------------------
  FB1         Ferrite Bead   B2     جداسازی/کاهش نویز ورودی 3.3V
  FB2         Ferrite Bead   B3     جداسازی تغذیه Analog
  C6          10µF           B2     ذخیره محلی جریان لحظه‌ای
  C1-C5,C23   100nF          B2     حذف نویز فرکانس بالا

**توجه:** FB1/FB2 هنوز انتخاب نهایی نشده‌اند. امپدانس، جریان مجاز و DC
resistance باید هنگام طراحی PCB انتخاب شوند.

------------------------------------------------------------------------

# 7. کریستال HSE

  Ref   قطعه        مقدار اولیه   بلوک   وظیفه
  ----- ----------- ------------- ------ -----------------
  X1    Crystal     8MHz          B4     مرجع کلاک خارجی
  C9    Capacitor   TBD           B4     Load capacitor
  C10   Capacitor   TBD           B4     Load capacitor

اتصال:

``` text
U1 pin 12 PH0/OSC_IN
        |
        +------ X1 8MHz ------+
        |                      |
       C9                     C10
        |                      |
       GND                    GND
        |                      |
U1 pin 13 PH1/OSC_OUT --------+
```

مقدار C9/C10 باید بر اساس CL کریستال انتخابی و ظرفیت پارازیتی PCB محاسبه
شود؛ بنابراین 10pF یا 22pF را بدون انتخاب کریستال نهایی نباید قطعی کرد.

------------------------------------------------------------------------

# 8. تغذیه U1

## 8.1 VDD

پایه‌های VDD:

``` text
U1-11
U1-27
U1-50
U1-75
U1-100
```

همه:

``` text
MCU_3V3 -> VDD
```

و برای هر VDD یک 100nF نزدیک پایه قرار می‌گیرد.

------------------------------------------------------------------------

## 8.2 VSS

پایه‌های VSS:

``` text
U1-10
U1-26
U1-49
U1-74
U1-99
```

همه:

``` text
VSS -> GND
```

------------------------------------------------------------------------

## 8.3 VCAP

``` text
U1-48 -> C21 2.2uF -> GND

U1-73 -> C22 2.2uF -> GND
```

VCAP به 3.3V وصل نمی‌شود.

------------------------------------------------------------------------

## 8.4 VBAT

در نسخه فعلی باتری RTC نداریم:

``` text
MCU_3V3 -> U1-6 VBAT
```

یک خازن محلی 100nF نیز در نظر گرفته شده است.

------------------------------------------------------------------------

# 9. تغذیه Analog

``` text
MCU_3V3
   |
  FB2
   |
 VDDA
   |
   +---- C17 1uF ---- AGND
   |
   +---- C18 100nF -- AGND
```

اتصالات:

``` text
U1-21 VDDA -> VDDA
U1-19 VSSA -> AGND
U1-20 VREF+ -> VDDA
```

VREF+:

``` text
VREF+
  |
  +---- C15 100nF ---- AGND
  |
  +---- C16 1uF ------ AGND
```

------------------------------------------------------------------------

# 10. Reset

مدار:

``` text
3V3
 |
R1 10k
 |
 +------------ NRST ------------ U1-14
 |                |
 C7 100nF         +---- R2 1k ---- J1-8
 |
GND

NRST ---- SW1 ---- GND
```

وظیفه: - Reset دستی - Reset از Raspberry Pi - ایجاد وضعیت Reset پایدار
هنگام روشن‌شدن

------------------------------------------------------------------------

# 11. BOOT0

``` text
U1-94 BOOT0
     |
     +---- R3 100k ---- GND
     |
     +---- JP1 --------- 3V3
```

حالت عادی:

``` text
JP1 باز -> BOOT0 = 0
```

حالت Bootloader:

``` text
JP1 بسته -> BOOT0 = 1
```

------------------------------------------------------------------------

# 12. SWD

J4:

    J4 Signal   مقصد
  ---- -------- ------------
     1 3V3      MCU_3V3
     2 SWDIO    U1-72 PA13
     3 GND      GND
     4 SWCLK    U1-76 PA14
     5 NRST     U1-14
     6 GND      GND

وظیفه: اتصال ST-Link برای Flash، Debug و تست Firmware.

------------------------------------------------------------------------

# 13. J1 --- Raspberry Pi Gateway

    J1 Signal       MCU            جهت
  ---- ------------ -------------- -------------
     1 3V3_LOGIC    Power          Pi → MCU
     2 GND          GND            مشترک
     3 SPI_MOSI     PA7 / pin31    Pi → MCU
     4 SPI_MISO     PA6 / pin30    MCU → Pi
     5 SPI_SCLK     PA5 / pin29    Pi → MCU
     6 SPI_CS_N     PA4 / pin28    Pi → MCU
     7 DATA_READY   PC13 / pin7    MCU → Pi
     8 MCU_RESET    NRST / pin14   Pi → MCU
     9 UART_TX      PA2 / pin24    MCU → Pi
    10 UART_RX      PA3 / pin25    Pi → MCU
    11 SYNC/IRQ2    PB11 / pin47   دوطرفه/رزرو
    12 GND          GND            مشترک

مسیر SPI:

``` text
Pi MOSI -> J1-3 -> 33R -> PA7
Pi MISO <- J1-4 <- 33R <- PA6
Pi SCLK -> J1-5 -> 33R -> PA5
Pi CS   -> J1-6 -> 33R -> PA4
```

------------------------------------------------------------------------

# 14. J2 --- TX Interface

    J2 Signal      MCU             جهت
  ---- ----------- --------------- --------------
     1 3V3_LOGIC   Power           MCU/TX logic
     2 GND         GND             مشترک
     3 TX_PULSE    PA8 / pin67     MCU → TX
     4 TX_ENABLE   PC6 / pin63     MCU → TX
     5 TX_BLANK    PC7 / pin64     MCU → TX
     6 TX_SYNC     PC9 / pin66     MCU → TX
     7 TX_FAULT    PC8 / pin65     TX → MCU
     8 TX_READY    PB0 / pin34     TX → MCU
     9 TX_TEMP     PC2_C / pin17   TX → MCU
    10 TX_VMON     PC3_C / pin18   TX → MCU
    11 TX_SENSE    PA0 / pin22     TX → MCU
    12 GND         GND             مشترک

**نکته:** J2 هیچ 12V توان را حمل نمی‌کند.

------------------------------------------------------------------------

# 15. J3 --- RX Interface

    J3 Signal       MCU            جهت
  ---- ------------ -------------- --------------
     1 3V3_LOGIC    Power          MCU/RX logic
     2 GND          GND            مشترک
     3 RX_BLANK     PA9 / pin68    MCU → RX
     4 RX_ENABLE    PA10 / pin69   MCU → RX
     5 RX_TRIGGER   PA11 / pin70   MCU → RX
     6 RX_SYNC      PB10 / pin46   MCU → RX
     7 RX_READY     PB9 / pin96    RX → MCU
     8 RX_FAULT     PB8 / pin95    RX → MCU
     9 RX_TEMP      PA1 / pin23    RX → MCU
    10 RX_VMON      PC0 / pin15    RX → MCU
    11 RX_SIGNAL    PC1 / pin16    RX → MCU
    12 GND          GND            مشترک

------------------------------------------------------------------------

# 16. بخش Analog Monitoring

## TX_TEMP

``` text
TX_TEMP
   |
  R
   |
   +------ ADC / U1-17 PC2_C
   |
  C
   |
  AGND
```

وظیفه: پایش دمای برد TX، مخصوصاً نزدیک Gate Driver/MOSFET در طراحی آینده.

------------------------------------------------------------------------

## TX_VMON

``` text
TX_VMON
   |
 Divider / Filter
   |
 U1-18 PC3_C
```

وظیفه: اندازه‌گیری ولتاژ تغذیه TX.

------------------------------------------------------------------------

## TX_SENSE

``` text
TX_SENSE
   |
 Filter / Protection
   |
 U1-22 PA0
```

وظیفه: دریافت سیگنال اندازه‌گیری از بخش TX در صورت نیاز طراحی نهایی.

------------------------------------------------------------------------

## RX_TEMP

``` text
RX_TEMP
   |
 Filter
   |
 U1-23 PA1
```

وظیفه: پایش دمای برد RX.

------------------------------------------------------------------------

## RX_VMON

``` text
RX_VMON
   |
 Divider / Filter
   |
 U1-15 PC0
```

وظیفه: پایش تغذیه RX.

------------------------------------------------------------------------

## RX_SIGNAL

``` text
RX_SIGNAL
    |
 Protection
    |
 Filter
    |
 U1-16 PC1
    |
    +---- Reserve ---> External ADC Header
```

وظیفه: دریافت سیگنال اندازه‌گیری‌شده RX.

**این بخش تا طراحی کامل RX نهایی نشده است و مقدار فیلتر و حفاظت نباید
قطعی فرض شود.**

------------------------------------------------------------------------

# 17. سنسور دمای داخلی MCU

STM32H743 دارای سنسور دمای داخلی است.

بنابراین برای دمای خود MCU فعلاً قطعه خارجی جداگانه لازم نیست.

``` text
Internal Temperature Sensor
          |
         ADC
          |
       Firmware
```

برای TX و RX سنسور خارجی همچنان در نظر گرفته می‌شود.

------------------------------------------------------------------------

# 18. TX_PULSE

مسیر:

``` text
U1-67 PA8
     |
     +---- J2-3 TX_PULSE
              |
              v
          TX Board
              |
         Gate Driver
              |
           MOSFET
              |
            Coil
```

**STM32 نباید مستقیماً Gate توان را درایو کند.**

Gate Driver و MOSFET متعلق به TX Board هستند.

------------------------------------------------------------------------

# 19. RX Timing

مسیرهای:

``` text
PA9  -> RX_BLANK
PA10 -> RX_ENABLE
PA11 -> RX_TRIGGER
PB10 -> RX_SYNC
```

برای زمان‌بندی دقیق دریافت طراحی شده‌اند.

هدف نهایی:

``` text
TX Pulse
   |
   +----> RX Blank
   |
   +----> RX Sampling Window
```

این زمان‌بندی باید با Timer/DMA و Trigger سخت‌افزاری پیاده‌سازی شود، نه با
delay نرم‌افزاری.

------------------------------------------------------------------------

# 20. Test Point ها

برای پایه‌های رزرو MCU، Test Point در نظر گرفته می‌شود.

نمونه:

``` text
PE2 -> TP1
PE3 -> TP2
PE4 -> TP3
...
PB7 -> TP93
PE0 -> TP97
PE1 -> TP98
```

هدف: - اسیلوسکوپ - Logic Analyzer - Debug - توسعه Firmware - رزرو برای
Revision آینده

پایه‌های رزرو نباید بدون دلیل به 3.3V یا GND متصل شوند.

------------------------------------------------------------------------

# 21. نگاشت پایه‌های U1

      Pin MCU Pin     کاربرد فعلی
  ------- ----------- ------------------
        1 PE2         TP1
        2 PE3         TP2
        3 PE4         TP3
        4 PE5         TP4
        5 PE6         TP5
        6 VBAT        3V3
        7 PC13        DATA_READY
        8 PC14        NC / LSE reserve
        9 PC15        NC / LSE reserve
       10 VSS         GND
       11 VDD         3V3
       12 PH0         HSE
       13 PH1         HSE
       14 NRST        RESET
       15 PC0         RX_VMON
       16 PC1         RX_SIGNAL
       17 PC2_C       TX_TEMP
       18 PC3_C       TX_VMON
       19 VSSA        AGND
       20 VREF+       VDDA reference
       21 VDDA        Analog 3V3
       22 PA0         TX_SENSE
       23 PA1         RX_TEMP
       24 PA2         UART_TX
       25 PA3         UART_RX
       26 VSS         GND
       27 VDD         3V3
       28 PA4         SPI_CS
       29 PA5         SPI_SCLK
       30 PA6         SPI_MISO
       31 PA7         SPI_MOSI
       32 PC4         TP32
       33 PC5         TP33
       34 PB0         TX_READY
       35 PB1         TP35
       36 PB2         TP36
    37-45 PE7-PE15    Test/Reserve
       46 PB10        RX_SYNC
       47 PB11        SYNC/IRQ2
       48 VCAP        2.2uF
       49 VSS         GND
       50 VDD         3V3
    51-54 PB12-PB15   Test/Reserve
    55-62 PD8-PD15    Test/Reserve
       63 PC6         TX_ENABLE
       64 PC7         TX_BLANK
       65 PC8         TX_FAULT
       66 PC9         TX_SYNC
       67 PA8         TX_PULSE
       68 PA9         RX_BLANK
       69 PA10        RX_ENABLE
       70 PA11        RX_TRIGGER
       71 PA12        TP71
       72 PA13        SWDIO
       73 VCAP        2.2uF
       74 VSS         GND
       75 VDD         3V3
       76 PA14        SWCLK
       77 PA15        TP77
    78-80 PC10-PC12   Test/Reserve
    81-88 PD0-PD7     Test/Reserve
    89-93 PB3-PB7     Test/Reserve
       94 BOOT0       Boot Jumper
       95 PB8         RX_FAULT
       96 PB9         RX_READY
       97 PE0         TP97
       98 PE1         TP98
       99 VSS         GND
      100 VDD         3V3

------------------------------------------------------------------------

# 22. فهرست اتصالات کلیدی

## Raspberry Pi → MCU

``` text
MOSI      -> PA7
MISO      -> PA6
SCLK      -> PA5
CS        -> PA4
DATA_READY <- PC13
RESET     -> NRST
UART_TX   <- PA2
UART_RX   -> PA3
SYNC/IRQ2 <-> PB11
```

## MCU → TX

``` text
PA8  -> TX_PULSE
PC6  -> TX_ENABLE
PC7  -> TX_BLANK
PC9  -> TX_SYNC
PC8  <- TX_FAULT
PB0  <- TX_READY
PC2_C <- TX_TEMP
PC3_C <- TX_VMON
PA0  <- TX_SENSE
```

## MCU ↔ RX

``` text
PA9   -> RX_BLANK
PA10  -> RX_ENABLE
PA11  -> RX_TRIGGER
PB10  -> RX_SYNC
PB9   <- RX_READY
PB8   <- RX_FAULT
PA1   <- RX_TEMP
PC0   <- RX_VMON
PC1   <- RX_SIGNAL
```

------------------------------------------------------------------------

# 23. قطعاتی که عمداً هنوز انتخاب نهایی نشده‌اند

این موارد باید بعد از تکمیل TX/RX تعیین شوند:

1.  مقدار دقیق R/C فیلترهای ADC.
2.  تقسیم مقاومتی TX_VMON.
3.  تقسیم مقاومتی RX_VMON.
4.  حفاظت RX_SIGNAL.
5.  نوع و مقدار TVS/ESD کانکتورها.
6.  مدل دقیق Ferrite Bead.
7.  مدل دقیق Crystal.
8.  مقدار دقیق C9/C10 بر اساس CL کریستال.
9.  سنسور دمای خارجی TX.
10. سنسور دمای خارجی RX.
11. ADC خارجی، در صورت نیاز.
12. مقدار مقاومت‌های Series مربوط به SPI/UART پس از بررسی Signal
    Integrity.

------------------------------------------------------------------------

# 24. قطعاتی که روی MCU Board نباید قرار بگیرند

در نسخه فعلی:

-   MOSFET قدرت TX
-   Gate Driver
-   Coil
-   12V power stage
-   Snubber قدرت
-   Flyback/TVS مربوط به کویل
-   تقویت‌کننده RX
-   فیلتر اصلی RX
-   Clamp ورودی کویل
-   مسیر جریان بالای کویل

این‌ها متعلق به TX/RX هستند.

------------------------------------------------------------------------

# 25. اصول Layout

## MCU

MCU در مرکز برد قرار بگیرد.

## Decoupling

خازن 100nF هر VDD تا حد امکان نزدیک پایه MCU.

## HSE

Crystal و C9/C10 نزدیک PH0/PH1.

## Analog

VDDA/VREF/VSSA از ناحیه دیجیتال و مسیرهای SPI فاصله داشته باشند.

## RX_SIGNAL

مسیر RX_SIGNAL کوتاه، تمیز و دور از TX_PULSE و مسیرهای توان.

## TX_PULSE

از ورودی‌های Analog فاصله داشته باشد.

## Ground

Ground plane پیوسته برای MCU استفاده شود؛ مسیر برگشت جریان توان TX نباید
از زمین حساس RX عبور کند.

------------------------------------------------------------------------

# 26. فلسفه طراحی پروژه

معماری نهایی:

``` text
                 Raspberry Pi 5
                       |
                SPI / UART / IRQ
                       |
                       v
              +------------------+
              |   STM32H743VIT6  |
              |                  |
              | Timing           |
              | Control          |
              | ADC              |
              | Processing       |
              +--------+---------+
                       |
             +---------+---------+
             |                   |
             v                   v
         TX BOARD            RX BOARD
             |                   |
         Gate Driver        RX Front End
             |                   |
          MOSFET             ADC/AMP
             |                   |
             +------ COIL -------+
```

اصل کلیدی:

**Raspberry Pi تصمیم‌گیری سطح بالا و پردازش سنگین را انجام می‌دهد؛ STM32
زمان‌بندی دقیق و Real-Time را انجام می‌دهد؛ TX و RX سخت‌افزارهای تخصصی و
نویزی را از MCU جدا می‌کنند.**

------------------------------------------------------------------------

# 27. وضعیت فعلی سند

-   انتخاب STM32H743VIT6
-   معماری چهار برد
-   J1/J2/J3
-   SPI
-   UART
-   DATA_READY
-   RESET
-   SWD
-   HSE
-   تغذیه دیجیتال
-   تغذیه Analog
-   VCAP
-   BOOT0
-   ADC monitoring
-   TX control
-   RX control
-   Test Point strategy