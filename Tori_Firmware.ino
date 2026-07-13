#include <Adafruit_NeoPixel.h>
#include <Arduino.h>
#include <AsyncTCP.h>
#include <BasicLinearAlgebra.h>
#include <DallasTemperature.h>
#include <ESP32Servo.h>
#include <ESPAsyncWebServer.h>
#include <HTTPClient.h>
#include <MPU9250.h>
#include <OneWire.h>
#include <TinyGPSPlus.h>
#include <WiFi.h>
#include <Wire.h>

using namespace BLA;

// --- Hardware Pins ---
const int enablePin = 4;
const int dirPin1 = 6;
const int dirPin2 = 5;
const int frontServoPin = 7;
const int backServoPin = 8;
const int rgbPin = 48;
const int tempPin = 11;
const int gpsRxPin = 38;
const int gpsTxPin = 40;
const int sdaPin = 9;
const int sclPin = 47;

// --- PWM Constants ---
const int pwmFreq = 5000;
const int pwmChannel = 0;
const int pwmResolution = 8;

// --- Objects ---
Servo frontServo;
Servo backServo;
AsyncWebServer server(80);
Adafruit_NeoPixel LED_RGB(1, rgbPin, NEO_GRB + NEO_KHZ800);
OneWire oneWire(tempPin);
DallasTemperature tempSensor(&oneWire);
HardwareSerial GPS_Serial(1);
TinyGPSPlus gps;
MPU9250 mpu;

// --- Global States & Thread Safety Flags ---
void TaskCore0(void *pvParameters); // Forward declaration for FreeRTOS task
TaskHandle_t TaskCore0Handle;
int currentSpeed = 0;
int targetServoAngle = 97;
int targetBackServoAngle = 97;
bool isStopped = true;
bool hardwareUpdateRequired = false;
bool servoUpdateRequired = false;
bool backServoUpdateRequired = false;
bool serverIsRunning = false;

// 0 = Normal, 1 = Calibrating Accel/Gyro, 2 = Calibrating Mag
int calibrationState = 0;

// --- WiFi Default Credentials ---
const char *defaultSSID = "IoT Lab";
const char *defaultPass = "bubt1234";

// --- Sensor Global Variables ---
float currentTemp = 0.0;
float currentLat = 0.0;
float currentLng = 0.0;
float mpuPitch = 0.0;
float mpuRoll = 0.0;
float mpuYaw = 0.0;

// --- ZUPT Extended Kalman Filter (EKF) State Matrices ---
// X-Axis
BLA::Matrix<2, 1> stateX = {0.0, 0.0}; // [posX, velX]^T
BLA::Matrix<2, 2> PX = {1.0, 0.0, 0.0, 1.0};

// Y-Axis
BLA::Matrix<2, 1> stateY = {0.0, 0.0}; // [posY, velY]^T
BLA::Matrix<2, 2> PY = {1.0, 0.0, 0.0, 1.0};

// Z-Axis
BLA::Matrix<2, 1> stateZ = {0.0, 0.0}; // [posZ, velZ]^T
BLA::Matrix<2, 2> PZ = {1.0, 0.0, 0.0, 1.0};

// Covariance Constants
BLA::Matrix<2, 2> Q = {0.001, 0.0, 0.0, 0.001}; // Process Noise
BLA::Matrix<1, 1> R = {0.01};                   // Measurement Noise
BLA::Matrix<1, 2> H = {0.0, 1.0};               // Measurement Matrix (We measure Velocity = 0)
BLA::Matrix<1, 1> Z_meas = {0.0};               // ZUPT Measurement (Velocity is zero)

// --- Navigation & Dead Reckoning Variables ---
float velX = 0.0, velY = 0.0, velZ = 0.0;
float posX = 0.0, posY = 0.0, posZ = 0.0;
unsigned long lastIntegrationTime = 0;

// --- Filter Settling / Warm-up Variable ---
unsigned long systemStartTime = 0;

unsigned long previousTempTime = 0;
const long tempInterval = 2000;

unsigned long previousMPUTime = 0;
const long mpuInterval = 10;

unsigned long previousSerialTime = 0;
const long serialInterval = 100;

// --- Logic Functions ---
void applyMotorLogic() {
  if (isStopped) {
    ledcWrite(pwmChannel, 0);
  } else {
    ledcWrite(pwmChannel, currentSpeed);
  }
}

void emergencyStop() {
  isStopped = true;
  currentSpeed = 0;
  targetServoAngle = 97;
  digitalWrite(dirPin1, LOW);
  digitalWrite(dirPin2, LOW);
  frontServo.write(97);
  backServo.write(97);
  applyMotorLogic();
  Serial.println("EVENT:HALTED");
}

void handleTemperature() {
  if (millis() - previousTempTime >= tempInterval) {
    previousTempTime = millis();
    tempSensor.requestTemperatures();
    float tempC = tempSensor.getTempCByIndex(0);
    if (tempC != DEVICE_DISCONNECTED_C) {
      currentTemp = tempC;
    }
  }
}

void handleGPS() {
  while (GPS_Serial.available() > 0) {
    gps.encode(GPS_Serial.read());
  }
  static unsigned long lastGpsTime = 0;
  if (millis() - lastGpsTime >= 2000) {
    lastGpsTime = millis();
    if (gps.location.isValid()) {
      currentLat = gps.location.lat();
      currentLng = gps.location.lng();
    }
  }
}

// ==========================================
// ADVANCED DEAD RECKONING (NHC & ZUPT)
// ==========================================
void handleMPU() {
  if (calibrationState != 0)
    return; // Do not run IMU logic during calibration

  if (millis() - previousMPUTime >= mpuInterval) {
    previousMPUTime = millis();

    if (mpu.update()) {
      mpuPitch = mpu.getPitch();
      mpuRoll = mpu.getRoll();
      mpuYaw = mpu.getYaw();

      unsigned long currentTime = micros();
      float dt = (currentTime - lastIntegrationTime) / 1000000.0;
      lastIntegrationTime = currentTime;

      if (millis() - systemStartTime < 3000) {
        posX = 0;
        posY = 0;
        posZ = 0;
        velX = 0;
        velY = 0;
        velZ = 0;
        return;
      }
      if (dt > 0.1)
        return;

      // Get Raw Linear Acceleration
      float rawAccX = mpu.getLinearAccX();
      float rawAccY = mpu.getLinearAccY();
      float rawAccZ = mpu.getLinearAccZ();

      float yaw_rad = mpuYaw * M_PI / 180.0;
      
      // Transform Body Acceleration to Earth Acceleration using Yaw
      float acc_earth_x = rawAccX * cos(yaw_rad) - rawAccY * sin(yaw_rad);
      float acc_earth_y = rawAccX * sin(yaw_rad) + rawAccY * cos(yaw_rad);
      float acc_earth_z = rawAccZ;

      // State Transition Matrix (F) and Control Matrix (B)
      BLA::Matrix<2, 2> F = {1.0, (float)dt, 0.0, 1.0};
      BLA::Matrix<2, 1> B = {0.5f * (float)dt * (float)dt, (float)dt};

      float DEADBAND = 0.12;
      BLA::Matrix<2, 2> I2 = {1.0, 0.0, 0.0, 1.0}; // 2x2 Identity Matrix

      // ----------------------------------------------------
      // X-Axis EKF (Earth Frame)
      // ----------------------------------------------------
      BLA::Matrix<1, 1> uX = {acc_earth_x * 9.81f};
      stateX = F * stateX + B * uX; // Prediction
      PX = F * PX * ~F + Q;

      if (abs(rawAccX) < DEADBAND) { // ZUPT Update (Zero Velocity Update)
        BLA::Matrix<1, 1> Y = Z_meas - H * stateX; // Innovation
        BLA::Matrix<1, 1> S = H * PX * ~H + R;     // Innovation Covariance
        BLA::Matrix<2, 1> K = PX * ~H * Inverse(S);// Kalman Gain
        
        stateX = stateX + K * Y;                   // State Update
        PX = (I2 - K * H) * PX;                    // Covariance Update
        
        stateX(1, 0) *= 0.85; // Additional hydrodynamic friction
      } else {
        stateX(1, 0) *= 0.98; // Continuous friction
      }

      // ----------------------------------------------------
      // Y-Axis EKF (Earth Frame)
      // ----------------------------------------------------
      BLA::Matrix<1, 1> uY = {acc_earth_y * 9.81f};
      stateY = F * stateY + B * uY;
      PY = F * PY * ~F + Q;

      if (abs(rawAccY) < DEADBAND) {
        BLA::Matrix<1, 1> Y = Z_meas - H * stateY;
        BLA::Matrix<1, 1> S = H * PY * ~H + R;
        BLA::Matrix<2, 1> K = PY * ~H * Inverse(S);
        
        stateY = stateY + K * Y;
        PY = (I2 - K * H) * PY;
        
        stateY(1, 0) *= 0.85;
      } else {
        stateY(1, 0) *= 0.98;
      }

      // ----------------------------------------------------
      // Z-Axis EKF
      // ----------------------------------------------------
      BLA::Matrix<1, 1> uZ = {acc_earth_z * 9.81f};
      stateZ = F * stateZ + B * uZ;
      PZ = F * PZ * ~F + Q;

      if (abs(rawAccZ) < DEADBAND) {
        BLA::Matrix<1, 1> Y = Z_meas - H * stateZ;
        BLA::Matrix<1, 1> S = H * PZ * ~H + R;
        BLA::Matrix<2, 1> K = PZ * ~H * Inverse(S);
        
        stateZ = stateZ + K * Y;
        PZ = (I2 - K * H) * PZ;
        
        stateZ(1, 0) *= 0.85;
      } else {
        stateZ(1, 0) *= 0.98;
      }

      // ----------------------------------------------------
      // Update global vars for telemetry
      // ----------------------------------------------------
      posX = stateX(0, 0);
      posY = stateY(0, 0);
      posZ = stateZ(0, 0);
      velX = stateX(1, 0);
      velY = stateY(1, 0);
      velZ = stateZ(1, 0);
    }
  }
}

void connectToWiFi(String reqSSID, String reqPass) {
  if (WiFi.status() == WL_CONNECTED) {
    WiFi.disconnect();
    delay(500);
  }
  Serial.println("STATUS:Attempting to connect to " + reqSSID);

  WiFi.begin(reqSSID.c_str(), reqPass.c_str());

  int wifiWait = 0;
  while (WiFi.status() != WL_CONNECTED && wifiWait < 20) {
    delay(500);
    wifiWait++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("STATUS:Connected! IP: " + WiFi.localIP().toString());
    if (!serverIsRunning) {
      server.begin();
      serverIsRunning = true;
    }
  } else {
    Serial.println("STATUS:WiFi Failed!");
    WiFi.disconnect();
  }
}

// --- Helper to Send Telemetry immediately to App so Modal pops up ---
void sendTelemetry() {
  String json = "{";
  json += "\"pitch\":" + String(mpuPitch, 2) + ",";
  json += "\"roll\":" + String(mpuRoll, 2) + ",";
  json += "\"yaw\":" + String(mpuYaw, 2) + ",";
  json += "\"posX\":" + String(posX, 4) + ",";
  json += "\"posY\":" + String(posY, 4) + ",";
  json += "\"posZ\":" + String(posZ, 4) + ",";
  json += "\"velX\":" + String(velX, 4) + ",";
  json += "\"lat\":" + String(currentLat, 6) + ",";
  json += "\"lng\":" + String(currentLng, 6) + ",";
  json += "\"temp\":" + String(currentTemp, 2) + ",";
  json += "\"cal\":" + String(calibrationState); // Added Calibration State
  json += "}";

  Serial.println("DATA:" + json); // Send via USB immediately
}

const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE HTML><html>
<head><title>Tori Web</title></head>
<body><h1>Web Server Active</h1></body>
</html>
)rawliteral";

void fetchIPLocation() {
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("STATUS: Fetching Location via IP API...");
    HTTPClient http;
    http.begin("http://ip-api.com/csv/?fields=lat,lon");
    int httpCode = http.GET();
    if (httpCode == 200) {
      String payload = http.getString();
      int commaIndex = payload.indexOf(',');
      if (commaIndex != -1) {
        currentLat = payload.substring(0, commaIndex).toFloat();
        currentLng = payload.substring(commaIndex + 1).toFloat();
        Serial.println(
            "STATUS: IP Location Updated! Lat: " + String(currentLat, 6) +
            " Lng: " + String(currentLng, 6));
      }
    } else {
      Serial.println("ERROR: IP API Failed (Code: " + String(httpCode) + ")");
    }
    http.end();
  }
}

void setup() {
  Serial.begin(115200);
  GPS_Serial.begin(9600, SERIAL_8N1, gpsRxPin, gpsTxPin);

  Wire.begin(sdaPin, sclPin);
  Wire.setClock(400000);
  delay(2000);

  tempSensor.begin();

  ledcSetup(pwmChannel, pwmFreq, pwmResolution);
  ledcAttachPin(enablePin, pwmChannel);
  pinMode(dirPin1, OUTPUT);
  pinMode(dirPin2, OUTPUT);

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  frontServo.attach(frontServoPin, 500, 2400);
  backServo.attach(backServoPin, 500, 2500);

  emergencyStop();

  // 1. CONNECT TO WIFI FIRST
  WiFi.mode(WIFI_STA);
  Serial.println("STATUS: Attempting to connect to default WiFi...");
  WiFi.begin(defaultSSID, defaultPass);

  unsigned long startAttemptTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 5000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("STATUS: WiFi Connected! IP: " + WiFi.localIP().toString());
    server.begin();
    serverIsRunning = true;
    fetchIPLocation();
  } else {
    Serial.println("STATUS: WiFi Failed! Running in USB-only mode.");
  }

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(200, "text/html", index_html);
  });

  server.on("/imu", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "{";
    json += "\"pitch\":" + String(mpuPitch, 2) + ",";
    json += "\"roll\":" + String(mpuRoll, 2) + ",";
    json += "\"yaw\":" + String(mpuYaw, 2) + ",";
    json += "\"posX\":" + String(posX, 4) + ",";
    json += "\"posY\":" + String(posY, 4) + ",";
    json += "\"posZ\":" + String(posZ, 4) + ",";
    json += "\"velX\":" + String(velX, 4) + ",";
    json += "\"lat\":" + String(currentLat, 6) + ",";
    json += "\"lng\":" + String(currentLng, 6) + ",";
    json += "\"temp\":" + String(currentTemp, 2) + ",";
    json += "\"cal\":" + String(calibrationState); // Send Cal State via Web
    json += "}";
    request->send(200, "application/json", json);
  });

  Serial.println("Ready for commands.");

  // 2. NOW START CALIBRATION
  if (!mpu.setup(0x68)) {
    Serial.println("ERROR: MPU9250 connection failed! Check Wiring.");
  }

  // Enable Madgwick Filter for better orientation stability
  mpu.selectFilter(QuatFilterSel::MADGWICK);

  // Give app a moment to connect if it was waiting
  delay(2000);

  // Tell the App we are starting Accel/Gyro calibration (Keep Still)
  calibrationState = 1;
  sendTelemetry();

  Serial.println(
      "Calibrating MPU... Please keep the submarine completely STILL!");
  mpu.calibrateAccelGyro();
  Serial.println("Accel & Gyro Calibration complete!");

  // Tell the App we are starting Magnetometer calibration (Figure-8)
  calibrationState = 2;
  sendTelemetry();

  Serial.println("Calibrating Magnetometer... PLEASE ROTATE THE SENSOR IN A "
                 "FIGURE-8 MOTION IN THE AIR!");
  mpu.calibrateMag();
  Serial.println("Magnetometer Calibration complete!");

  // Tell the App calibration is done
  calibrationState = 0;
  sendTelemetry();

  systemStartTime = millis();
  lastIntegrationTime = micros();

  // Create the FreeRTOS Task and pin it to Core 0
  xTaskCreatePinnedToCore(TaskCore0,        // Function to implement the task
                          "TaskCore0",      // Name of the task
                          10000,            // Stack size in words
                          NULL,             // Task input parameter
                          1,                // Priority of the task
                          &TaskCore0Handle, // Task handle
                          0);               // Core where the task should run
}

void loop() {
  if (hardwareUpdateRequired) {
    applyMotorLogic();
    hardwareUpdateRequired = false;
  }
  if (servoUpdateRequired) {
    frontServo.write(targetServoAngle);
    servoUpdateRequired = false;
  }
  if (backServoUpdateRequired) {
    backServo.write(targetBackServoAngle);
    backServoUpdateRequired = false;
  }

  // Only Fast, Non-Blocking, Real-Time tasks remain in Core 1 Loop
  handleMPU();

  // --- USB / Serial Telemetry Streaming ---
  if (millis() - previousSerialTime >= serialInterval) {
    previousSerialTime = millis();
    sendTelemetry();
  }

  yield(); // Required to prevent watchdog reset
}

void processSerialCommand(String cmd) {
  if (cmd.startsWith("WIFI:")) {
    int firstColon = cmd.indexOf(':');
    int secondColon = cmd.indexOf(':', firstColon + 1);

    if (secondColon != -1) {
      String reqSSID = cmd.substring(firstColon + 1, secondColon);
      String reqPass = cmd.substring(secondColon + 1);
      connectToWiFi(reqSSID, reqPass);
    }
  } else if (cmd == "DIR:FWD") {
    digitalWrite(dirPin1, HIGH);
    digitalWrite(dirPin2, LOW);
    isStopped = false;
    hardwareUpdateRequired = true;
  } else if (cmd == "DIR:REV") {
    digitalWrite(dirPin1, LOW);
    digitalWrite(dirPin2, HIGH);
    isStopped = false;
    hardwareUpdateRequired = true;
  } else if (cmd.startsWith("SPD:")) {
    currentSpeed = cmd.substring(4).toInt();
    hardwareUpdateRequired =
        true; // Use flag to trigger applyMotorLogic safely on Core 1
  } else if (cmd.startsWith("F_SRV:")) {
    targetServoAngle = cmd.substring(6).toInt();
    servoUpdateRequired = true;
  } else if (cmd.startsWith("B_SRV:")) {
    targetBackServoAngle = cmd.substring(6).toInt();
    backServoUpdateRequired = true;
  } else if (cmd == "STOP") {
    // Cannot safely call emergencyStop() from Core 0 because it modifies
    // servos/PWM directly. Instead set the target states and flags to let Core
    // 1 handle it.
    isStopped = true;
    currentSpeed = 0;
    targetServoAngle = 97;
    targetBackServoAngle = 97;
    digitalWrite(dirPin1, LOW);
    digitalWrite(dirPin2, LOW);
    hardwareUpdateRequired = true;
    servoUpdateRequired = true;
    backServoUpdateRequired = true;
  } else if (cmd == "RESET_POS") {
    posX = 0;
    posY = 0;
    posZ = 0;
    velX = 0;
    velY = 0;
    velZ = 0;
    Serial.println("STATUS: Position Reset");
  } else if (cmd == "CALIBRATE") {
    Serial.println("STATUS: Starting Hardware Calibration...");
    calibrationState = 1;
    sendTelemetry();
    delay(100);
    Serial.println(
        "Calibrating MPU... Please keep the submarine completely STILL!");
    mpu.calibrateAccelGyro();
    Serial.println("Accel & Gyro Calibration complete!");
    calibrationState = 2;
    sendTelemetry();
    delay(100);
    Serial.println("Calibrating Magnetometer... PLEASE ROTATE THE SENSOR IN A "
                   "FIGURE-8 MOTION IN THE AIR!");
    mpu.calibrateMag();
    Serial.println("Magnetometer Calibration complete!");
    calibrationState = 0;
    sendTelemetry();
  } else if (cmd == "IP") {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("STATUS:IP:" + WiFi.localIP().toString());
    } else {
      Serial.println("STATUS:IP: not connected");
    }
  }
}

// =========================================================================
// CORE 0 TASK (Slow, Protocol, blocking, network and peripheral tasks)
// =========================================================================
void TaskCore0(void *pvParameters) {
  for (;;) {
    // Read Temperature Sensor (Very Slow: Blocks for ~750ms!)
    handleTemperature();

    // Read GPS Serial (Slow: 9600 baud processing)
    handleGPS();

    // Read USB Commands
    if (Serial.available() > 0) {
      String cmd = Serial.readStringUntil('\n');
      cmd.trim();
      processSerialCommand(cmd);
    }

    // Feed the watchdog timer to prevent crashes on Core 0
    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}
