#include <Adafruit_NeoPixel.h>
#include <Arduino.h>
#include <AsyncTCP.h>
#include <BasicLinearAlgebra.h>
#include <DallasTemperature.h>
#include <ESPAsyncWebServer.h>
#include <ESPmDNS.h> // iPad এ সহজে tori.local দিয়ে এক্সেস করার জন্য
#include <HTTPClient.h>
#include <MPU9250.h>
#include <OneWire.h>
#include <TinyGPSPlus.h>
#include <WiFi.h>
#include <Wire.h>

using namespace BLA;

#include <NewPing.h>
#define TRIGGER_PIN 10 // TX equivalent
#define ECHO_PIN 14    // RX equivalent
#define MAX_DISTANCE 400
NewPing sonar(TRIGGER_PIN, ECHO_PIN, MAX_DISTANCE);
bool obstacleDetected = false;
int currentObsDist = -1;

// --- Hardware Pins ---
const int dirPin1 = 12; // L298N IN1 (PWM Forward)
const int dirPin2 = 13; // L298N IN2 (PWM Reverse)
const int sharkServoPin = 4;
const int leftServoPin = 7;
const int rightServoPin = 8;
const int rgbPin = 48;
const int tempPin = 11;
const int gpsRxPin = 38;
const int gpsTxPin = 40;
const int sdaPin = 9;
const int sclPin = 47;

// --- PWM Constants ---
const int pwmFreq = 5000;
const int pwmChannel1 = 0;
const int pwmChannel2 = 1;
const int pwmResolution = 8;

// --- Objects ---
AsyncWebServer server(80);
Adafruit_NeoPixel LED_RGB(1, rgbPin, NEO_GRB + NEO_KHZ800);
OneWire oneWire(tempPin);
DallasTemperature tempSensor(&oneWire);
HardwareSerial GPS_Serial(1);
TinyGPSPlus gps;
MPU9250 mpu;

// --- Global States & Thread Safety Flags ---
void TaskCore0(void *pvParameters);
TaskHandle_t TaskCore0Handle;
int currentSpeed = 0;
int targetLeftAngle = 97;
int targetRightAngle = 97;
int targetSharkAngle = 90;
bool isStopped = true;
bool isForward = true;
bool hardwareUpdateRequired = false;
bool leftServoUpdateRequired = false;
bool rightServoUpdateRequired = false;
bool sharkServoUpdateRequired = false;
bool serverIsRunning = false;

// 0 = Normal, 1 = Calibrating Accel/Gyro, 2 = Calibrating Mag
int calibrationState = 0;

// --- Sensor Global Variables ---
float currentTemp = 0.0;
float currentLat = 0.0;
float currentLng = 0.0;
float mpuPitch = 0.0;
float mpuRoll = 0.0;
float mpuYaw = 0.0;

// --- ZUPT Extended Kalman Filter (EKF) State Matrices ---
BLA::Matrix<2, 1> stateX = {0.0, 0.0};
BLA::Matrix<2, 2> PX = {1.0, 0.0, 0.0, 1.0};
BLA::Matrix<2, 1> stateY = {0.0, 0.0};
BLA::Matrix<2, 2> PY = {1.0, 0.0, 0.0, 1.0};
BLA::Matrix<2, 1> stateZ = {0.0, 0.0};
BLA::Matrix<2, 2> PZ = {1.0, 0.0, 0.0, 1.0};

BLA::Matrix<2, 2> Q = {0.001, 0.0, 0.0, 0.001};
BLA::Matrix<1, 1> R = {0.01};
BLA::Matrix<1, 2> H = {0.0, 1.0};
BLA::Matrix<1, 1> Z_meas = {0.0};

// --- Navigation & Dead Reckoning Variables ---
float velX = 0.0, velY = 0.0, velZ = 0.0;
float posX = 0.0, posY = 0.0, posZ = 0.0;
unsigned long lastIntegrationTime = 0;
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
    ledcWrite(pwmChannel1, 0);
    ledcWrite(pwmChannel2, 0);
  } else {
    if (isForward) {
      ledcWrite(pwmChannel1, currentSpeed);
      ledcWrite(pwmChannel2, 0);
    } else {
      ledcWrite(pwmChannel1, 0);
      ledcWrite(pwmChannel2, currentSpeed);
    }
  }
}

void writeServo(int channel, int angle) {
  int pulse = map(angle, 0, 180, 500, 2500);
  int duty = (pulse * 16383) / 20000;
  ledcWrite(channel, duty);
}

void emergencyStop() {
  isStopped = true;
  currentSpeed = 0;
  targetLeftAngle = 97;
  targetRightAngle = 97;
  targetSharkAngle = 90;
  isForward = true;
  applyMotorLogic();
  leftServoUpdateRequired = true;
  rightServoUpdateRequired = true;
  sharkServoUpdateRequired = true;
  Serial.println("EVENT:HALTED");
}

void handleUltrasonic() {
  static unsigned long lastSonarTime = 0;
  if (millis() - lastSonarTime >= 200) {
    lastSonarTime = millis();
    int distance = sonar.ping_median(5) / 58;
    currentObsDist = distance;

    if (distance > 5 && distance < 100) {
      if (!obstacleDetected) {
        obstacleDetected = true;
        emergencyStop();
      }
    } else {
      obstacleDetected = false;
    }
  }
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

void handleMPU() {
  if (calibrationState != 0)
    return;

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
        posX = posY = posZ = velX = velY = velZ = 0;
        return;
      }
      if (dt > 0.1)
        return;

      float rawAccX = mpu.getLinearAccX();
      float rawAccY = mpu.getLinearAccY();
      float rawAccZ = mpu.getLinearAccZ();

      float yaw_rad = mpuYaw * M_PI / 180.0;
      float acc_earth_x = rawAccX * cos(yaw_rad) - rawAccY * sin(yaw_rad);
      float acc_earth_y = rawAccX * sin(yaw_rad) + rawAccY * cos(yaw_rad);
      float acc_earth_z = rawAccZ;

      BLA::Matrix<2, 2> F = {1.0, (float)dt, 0.0, 1.0};
      BLA::Matrix<2, 1> B = {0.5f * (float)dt * (float)dt, (float)dt};
      float DEADBAND = 0.12;
      BLA::Matrix<2, 2> I2 = {1.0, 0.0, 0.0, 1.0};

      // X-Axis
      BLA::Matrix<1, 1> uX = {acc_earth_x * 9.81f};
      stateX = F * stateX + B * uX;
      PX = F * PX * ~F + Q;
      if (abs(rawAccX) < DEADBAND) {
        BLA::Matrix<1, 1> Y = Z_meas - H * stateX;
        BLA::Matrix<1, 1> S = H * PX * ~H + R;
        BLA::Matrix<2, 1> K = PX * ~H * Inverse(S);
        stateX = stateX + K * Y;
        PX = (I2 - K * H) * PX;
        stateX(1, 0) *= 0.85;
      } else {
        stateX(1, 0) *= 0.98;
      }

      // Y-Axis
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

      // Z-Axis
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

      posX = stateX(0, 0);
      posY = stateY(0, 0);
      posZ = stateZ(0, 0);
      velX = stateX(1, 0);
      velY = stateY(1, 0);
      velZ = stateZ(1, 0);
    }
  }
}

String buildTelemetryJson() {
  String json = "{";
  json += "\"pitch\":" + String(mpuPitch, 2) + ",";
  json += "\"roll\":" + String(mpuRoll, 2) + ",";
  json += "\"yaw\":" + String(mpuYaw, 2) + ",";
  json += "\"posX\":" + String(posX, 4) + ",";
  json += "\"posY\":" + String(posY, 4) + ",";
  json += "\"posZ\":" + String(posZ, 4) + ",";
  json += "\"velX\":" + String(velX, 4) + ",";
  json += "\"leftAngle\":" + String(targetLeftAngle) + ",";
  json += "\"rightAngle\":" + String(targetRightAngle) + ",";
  json += "\"sharkAngle\":" + String(targetSharkAngle) + ",";
  json += "\"lat\":" + String(currentLat, 6) + ",";
  json += "\"lng\":" + String(currentLng, 6) + ",";
  json += "\"temp\":" + String(currentTemp, 2) + ",";
  json += "\"obsDist\":" + String(currentObsDist) + ",";
  json += "\"cal\":" + String(calibrationState);
  json += "}";
  return json;
}

void sendTelemetry() {
  String json = buildTelemetryJson();
  Serial.println("DATA:" + json);
}

const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE HTML><html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tori Submarine</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 16px; background: #0f172a; color: #f8fafc; }
    .card { background: #111827; padding: 12px; border-radius: 10px; margin-bottom: 10px; }
    button { padding: 10px 12px; margin: 4px; border: 0; border-radius: 8px; background: #2563eb; color: white; }
    .small { font-size: 14px; color: #cbd5e1; }
  </style>
</head>
<body>
  <h2>Tori Submarine</h2>
  <div class="card">
    <button onclick="sendAction('forward')">Forward</button>
    <button onclick="sendAction('reverse')">Reverse</button>
    <button onclick="sendAction('stopped')">Stop</button>
  </div>
  <div class="card">
    <label>Speed <input id="speed" type="range" min="0" max="255" value="0" onchange="sendSpeed(this.value)"></label>
    <div id="speedValue" class="small">0</div>
  </div>
  <div class="card">
    <div class="small">Pitch: <span id="pitch">--</span></div>
    <div class="small">Roll: <span id="roll">--</span></div>
    <div class="small">Yaw: <span id="yaw">--</span></div>
    <div class="small">Temp: <span id="temp">--</span> °C</div>
    <div class="small">Obstacle: <span id="obsDist">--</span> cm</div>
    <div class="small">Lat/Lng: <span id="lat">--</span>, <span id="lng">--</span></div>
    <div class="small">Left/Right/Shark: <span id="leftAngle">--</span> / <span id="rightAngle">--</span> / <span id="sharkAngle">--</span></div>
  </div>
  <script>
    function update(data) {
      document.getElementById('pitch').textContent = data.pitch ?? '--';
      document.getElementById('roll').textContent = data.roll ?? '--';
      document.getElementById('yaw').textContent = data.yaw ?? '--';
      document.getElementById('temp').textContent = data.temp ?? '--';
      document.getElementById('obsDist').textContent = data.obsDist ?? '--';
      document.getElementById('lat').textContent = data.lat ?? '--';
      document.getElementById('lng').textContent = data.lng ?? '--';
      document.getElementById('leftAngle').textContent = data.leftAngle ?? '--';
      document.getElementById('rightAngle').textContent = data.rightAngle ?? '--';
      document.getElementById('sharkAngle').textContent = data.sharkAngle ?? '--';
      document.getElementById('speedValue').textContent = document.getElementById('speed').value;
    }
    function refresh() {
      fetch('/imu').then(r => r.json()).then(update).catch(() => {});
    }
    function sendAction(dir) {
      fetch('/action?dir=' + dir);
    }
    function sendSpeed(val) {
      fetch('/speed?val=' + val);
    }
    setInterval(refresh, 1000);
    refresh();
  </script>
</body>
</html>
)rawliteral";

void setup() {
  // ১. Serial (Mac এর জন্য) ইনিশিয়ালাইজ করা
  Serial.begin(115200);

  // ২. Startup delay
  delay(2000);
  Serial.println("STATUS: System Booting.");

  GPS_Serial.begin(9600, SERIAL_8N1, gpsRxPin, gpsTxPin);
  Wire.begin(sdaPin, sclPin);
  Wire.setClock(400000);

  tempSensor.begin();
  tempSensor.setWaitForConversion(false);

  ledcSetup(pwmChannel1, pwmFreq, pwmResolution);
  ledcSetup(pwmChannel2, pwmFreq, pwmResolution);
  ledcAttachPin(dirPin1, pwmChannel1);
  ledcAttachPin(dirPin2, pwmChannel2);

  ledcSetup(2, 50, 14);
  ledcSetup(3, 50, 14);
  ledcSetup(4, 50, 14);
  ledcAttachPin(leftServoPin, 2);
  ledcAttachPin(rightServoPin, 3);
  ledcAttachPin(sharkServoPin, 4);

  emergencyStop();

  // ৩. WiFi AP Mode চালু রাখা (যাতে নেটওয়ার্ক স্ট্যাক পুরোপুরি রেডি হয়)
  WiFi.mode(WIFI_AP);
  WiFi.softAP("Tori_Submarine", "12345678");
  Serial.print("STATUS: Network Stack Ready. AP IP: ");
  Serial.println(WiFi.softAPIP());

  // ৪. mDNS চালু করা (যাতে iPad এ tori.local দিয়ে এক্সেস করা যায়)
  if (!MDNS.begin("tori")) {
    Serial.println("ERROR: Error setting up MDNS responder!");
  } else {
    Serial.println("STATUS: mDNS responder started. You can use "
                   "http://tori.local in iPad App");
  }

  // ৫. ওয়েব সার্ভার চালু করা (iPad / Browser এর জন্য CORS Header সহ)
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(200, "text/html", index_html);
  });

  // (আপনার আগের সবগুলো API Endpoints)
  server.on("/imu", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(200, "application/json", buildTelemetryJson());
  });

  server.on("/telemetry", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(200, "application/json", buildTelemetryJson());
  });

  server.on("/status", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(200, "application/json", buildTelemetryJson());
  });

  server.on("/left_servo", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->hasParam("val")) {
      targetLeftAngle = request->getParam("val")->value().toInt();
      leftServoUpdateRequired = true;
      request->send(200, "text/plain", "OK");
    } else {
      request->send(400, "text/plain", "Missing val");
    }
  });

  server.on("/right_servo", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->hasParam("val")) {
      targetRightAngle = request->getParam("val")->value().toInt();
      rightServoUpdateRequired = true;
      request->send(200, "text/plain", "OK");
    } else {
      request->send(400, "text/plain", "Missing val");
    }
  });

  server.on("/shark_servo", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->hasParam("val")) {
      targetSharkAngle = request->getParam("val")->value().toInt();
      sharkServoUpdateRequired = true;
      request->send(200, "text/plain", "OK");
    } else {
      request->send(400, "text/plain", "Missing val");
    }
  });

  server.on("/action", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->hasParam("dir")) {
      String dir = request->getParam("dir")->value();
      if (dir == "forward") {
        isForward = true;
        isStopped = false;
      } else if (dir == "reverse") {
        isForward = false;
        isStopped = false;
      } else if (dir == "stopped") {
        isStopped = true;
        currentSpeed = 0;
        targetLeftAngle = 97;
        targetRightAngle = 97;
        targetSharkAngle = 90;
        isForward = true;
        leftServoUpdateRequired = true;
        rightServoUpdateRequired = true;
        sharkServoUpdateRequired = true;
      }
      hardwareUpdateRequired = true;
      request->send(200, "text/plain", "OK");
    } else {
      request->send(400, "text/plain", "Missing dir");
    }
  });

  server.on("/speed", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->hasParam("val")) {
      currentSpeed = request->getParam("val")->value().toInt();
      hardwareUpdateRequired = true;
      request->send(200, "text/plain", "OK");
    } else {
      request->send(400, "text/plain", "Missing val");
    }
  });

  server.begin();
  serverIsRunning = true;
  Serial.println("STATUS: Web Server Started!");

  // MPU Setup
  if (!mpu.setup(0x68)) {
    Serial.println("ERROR: MPU9250 connection failed! Check Wiring.");
  }
  mpu.selectFilter(QuatFilterSel::MADGWICK);

  calibrationState = 1;
  sendTelemetry();
  Serial.println(
      "Calibrating MPU... Please keep the submarine completely STILL!");
  mpu.calibrateAccelGyro();
  Serial.println("Accel & Gyro Calibration complete!");

  calibrationState = 2;
  sendTelemetry();
  Serial.println("Calibrating Magnetometer... PLEASE ROTATE THE SENSOR IN A "
                 "FIGURE-8 MOTION!");
  mpu.calibrateMag();
  Serial.println("Magnetometer Calibration complete!");

  calibrationState = 0;
  sendTelemetry();

  systemStartTime = millis();
  lastIntegrationTime = micros();

  xTaskCreatePinnedToCore(TaskCore0, "TaskCore0", 10000, NULL, 1,
                          &TaskCore0Handle, 0);
}

void loop() {
  if (hardwareUpdateRequired) {
    applyMotorLogic();
    hardwareUpdateRequired = false;
  }
  if (leftServoUpdateRequired) {
    writeServo(2, targetLeftAngle);
    leftServoUpdateRequired = false;
  }
  if (rightServoUpdateRequired) {
    writeServo(3, targetRightAngle);
    rightServoUpdateRequired = false;
  }
  if (sharkServoUpdateRequired) {
    writeServo(4, targetSharkAngle);
    sharkServoUpdateRequired = false;
  }

  handleUltrasonic();
  handleMPU();

  if (millis() - previousSerialTime >= serialInterval) {
    previousSerialTime = millis();
    sendTelemetry();
  }

  yield();
}

void processSerialCommand(String cmd) {
  if (cmd == "DIR:FWD") {
    isForward = true;
    isStopped = false;
    hardwareUpdateRequired = true;
  } else if (cmd == "DIR:REV") {
    isForward = false;
    isStopped = false;
    hardwareUpdateRequired = true;
  } else if (cmd.startsWith("SPD:")) {
    currentSpeed = cmd.substring(4).toInt();
    hardwareUpdateRequired = true;
  } else if (cmd.startsWith("L_SRV:")) {
    targetLeftAngle = cmd.substring(6).toInt();
    leftServoUpdateRequired = true;
  } else if (cmd.startsWith("R_SRV:")) {
    targetRightAngle = cmd.substring(6).toInt();
    rightServoUpdateRequired = true;
  } else if (cmd.startsWith("S_SRV:")) {
    targetSharkAngle = cmd.substring(6).toInt();
    sharkServoUpdateRequired = true;
  } else if (cmd == "STOP") {
    isStopped = true;
    currentSpeed = 0;
    targetLeftAngle = 97;
    targetRightAngle = 97;
    targetSharkAngle = 90;
    isForward = true;
    hardwareUpdateRequired = true;
    leftServoUpdateRequired = true;
    rightServoUpdateRequired = true;
    sharkServoUpdateRequired = true;
  } else if (cmd == "RESET_POS") {
    posX = posY = posZ = velX = velY = velZ = 0;
    Serial.println("STATUS: Position Reset");
  } else if (cmd == "CALIBRATE") {
    Serial.println("STATUS: Starting Hardware Calibration...");
    calibrationState = 1;
    sendTelemetry();
    delay(100);
    mpu.calibrateAccelGyro();
    calibrationState = 2;
    sendTelemetry();
    delay(100);
    mpu.calibrateMag();
    calibrationState = 0;
    sendTelemetry();
  }
}

void TaskCore0(void *pvParameters) {
  for (;;) {
    handleTemperature();
    handleGPS();

    while (Serial.available() > 0) {
      String cmd = Serial.readStringUntil('\n');
      cmd.trim();
      if (cmd.length() > 0) {
        processSerialCommand(cmd);
      }
    }
    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}
