#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

const char* ssid = "Xiaomi 11i";
const char* password = "mahawar10";

const char* host = "10.156.8.130";
const uint16_t port = 8080;

WebSocketsClient ws;

String room = "room2";
#define LOAD1 25
#define LOAD2 26

/* SENSOR */
#define VOLT_PIN 34
#define CURR_PIN 35

unsigned long lastSend = 0;

/* CALIBRATION */
float voltageCal = 0.89;
float currentOffset = 0;

/* ENERGY */
float energy = 0;
unsigned long lastTime = 0;

/* AUTO OFFSET CALIBRATION */
void calibrateCurrent() {
  float sum = 0;

  for(int i=0;i<500;i++){
    sum += analogRead(CURR_PIN) * (3.3 / 4095.0);
    delay(2);
  }

  currentOffset = sum / 500.0;

  Serial.print("Auto Offset: ");
  Serial.println(currentOffset);
}

/* VOLTAGE */
float readVoltage() {
  float sum = 0;

  for(int i=0;i<200;i++){
    float v = analogRead(VOLT_PIN) * (3.3 / 4095.0);
    sum += v * v;
  }

  return sqrt(sum / 200.0) * 80 * voltageCal;
}

/* CURRENT (STABLE) */
float readCurrent() {

  float sum = 0;

  for(int i=0;i<200;i++){
    float c = analogRead(CURR_PIN) * (3.3 / 4095.0);
    c = c - currentOffset;

    if (abs(c) < 0.02) c = 0; // noise cut

    sum += c * c;
  }

  float Irms = sqrt(sum / 200.0) / 0.185;

  return Irms;
}

/* LOAD TYPE */
String detectLoad(float P) {

  if (P < 50) return "Charger";
  else if (P < 150) return "Fan";
  else return "Heavy Load";
}

/* SEND DATA */
void sendData() {

  float V = readVoltage();
  float I = readCurrent();

  if (V < 20) V = 0;
  if (I < 0.15) I = 0;

  float P = V * I;
  if (P < 5) P = 0;

  /* ENERGY */
  unsigned long currentTime = millis();
  float dt = (currentTime - lastTime) / 1000.0;
  lastTime = currentTime;

  energy += (P / 1000.0) * (dt / 3600.0);

  float cost = energy * 8.0;

  float PF = (V*I > 0) ? P/(V*I) : 0;
  float phase = acos(PF) * 180 / PI;

  String loadType = detectLoad(P);

  StaticJsonDocument<400> doc;

  doc["type"] = "data";
  doc["esp"] = room;

  doc["voltage"] = V;
  doc["current"] = I;
  doc["power"] = P;
  doc["pf"] = PF;
  doc["phase"] = phase;
  doc["energy"] = energy;
  doc["cost"] = cost;
  doc["load"] = loadType;

  String json;
  serializeJson(doc, json);

  ws.sendTXT(json);

  Serial.println(json);
}

/* CONTROL */
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {

  if (type == WStype_CONNECTED) {
    ws.sendTXT("{\"type\":\"register\",\"esp\":\"room2\"}");
  }

  if (type == WStype_TEXT) {

    StaticJsonDocument<200> doc;
    if (deserializeJson(doc, payload)) return;

    if (doc["esp"] == room) {

      if (doc.containsKey("load1"))
        digitalWrite(LOAD1, doc["load1"] ? LOW : HIGH);

      if (doc.containsKey("load2"))
        digitalWrite(LOAD2, doc["load2"] ? LOW : HIGH);
    }
  }
}

void setup() {

  Serial.begin(115200);

  pinMode(LOAD1, OUTPUT);
  pinMode(LOAD2, OUTPUT);

  digitalWrite(LOAD1, HIGH);
  digitalWrite(LOAD2, HIGH);

  calibrateCurrent();   // 🔥 AUTO CALIBRATION

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  ws.begin(host, port, "/");
  ws.onEvent(webSocketEvent);
}

void loop() {

  ws.loop();

  if (millis() - lastSend > 2000) {
    sendData();
    lastSend = millis();
  }
}