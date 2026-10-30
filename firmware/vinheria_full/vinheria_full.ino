/*
  VINHERIA SENSE - CHECK POINT 5
  ESP32 + DHT11/DHT22 + LDR + LED AZUL + BUZZER + FIWARE (MQTT)

  Funcoes:
  - Monitoramento de temperatura
  - Monitoramento de umidade
  - Monitoramento de luminosidade
  - LED azul piscando durante anomalias
  - Alertas sonoros diferentes para cada anomalia
  - Integracao FIWARE (IoT Agent UltraLight 2.0 + Mosquitto) via MQTT:
      * publica sensores (t, h, l) e estado dos atuadores (s)
      * recebe comandos para buzzer e LED

  Dependencias (Arduino IDE): instale pelo Gerenciador de Bibliotecas
  "PubSubClient" (Nick O'Leary, versao 2.8 ou superior, por causa do
  setBufferSize) e "DHT sensor library for ESPx" (DHTesp).
  
  Authors: Felippe Tuma, Yan da Silva, Davi Toyota, Renan Martins, Arthur Nepomuceno, Felipe Motta
*/

// WiFi (core do ESP32) e cliente MQTT
#include <WiFi.h>
#include <PubSubClient.h>

// Biblioteca do sensor DHT
#include "DHTesp.h"

// ---------------- CONFIGURACAO FIWARE / REDE ----------------
// Preencha com os seus dados. Nao versione credenciais reais.

// WiFi (no Wokwi: "Wokwi-GUEST" e senha vazia)
#define WIFI_SSID      "SEU_WIFI_SSID"
#define WIFI_PASSWORD  "SUA_SENHA_WIFI"

// Broker MQTT (Mosquitto)
#define MQTT_BROKER    "fiware_server_ip"
#define MQTT_PORT      1883
// Deixe MQTT_USER vazio ("") para conectar sem autenticacao
#define MQTT_USER      ""
#define MQTT_PASSWORD  ""

// Os mesmos valores provisionados no IoT Agent (service group e device)
#define APIKEY         "TEF"
#define DEVICE_ID      "vinheria001"

// Intervalos (ms)
const unsigned long INTERVALO_PUB_SENSORES = 5000;   // publicacao de t, h, l
const unsigned long INTERVALO_PUB_ESTADO   = 10000;  // republicacao periodica de s
const unsigned long INTERVALO_RECONEXAO    = 5000;   // tentativas de MQTT
const unsigned long INTERVALO_RECONEXAO_WIFI = 10000; // tentativas de WiFi (associar leva alguns segundos)

// Tamanhos fixos dos buffers da camada de comunicacao
const uint16_t MQTT_BUFFER_BYTES = 256;  // padrao do PubSubClient e pequeno demais
const uint16_t MQTT_TIMEOUT_S = 3;       // limita o bloqueio de uma tentativa de connect
const size_t TAM_TOPICO = 96;
const size_t TAM_PAYLOAD = 128;
const size_t TAM_VALOR = 16;
const size_t TAM_MENSAGEM_CMD = 64;
const size_t TAM_CLIENT_ID = 64;

// ---------------- PINOS ----------------

#define DHT_PIN 15
#define LDR_PIN 34
#define LED_AZUL 2
#define BUZZER 25

// ---------------- SENSOR DHT ----------------

// Tipo do sensor: hardware real = DHT11.
// No Wokwi (que simula um DHT22) use DHTesp::DHT22.
#define DHT_TYPE DHTesp::DHT22

// Casas decimais publicadas: DHT11 tem resolucao de 1 unidade (0).
// Com DHT22 / Wokwi use 1.
#define DHT_CASAS_DECIMAIS 1

DHTesp dht;

// ---------------- LIMITES DOS SENSORES ----------------

// Faixa do DHT11: 0 a 50 C e 20 a 90 % UR. Os limites abaixo estao dentro dela.

// Temperatura em graus Celsius
float temperaturaMin = 10.0;
float temperaturaMax = 15.0;

// Umidade relativa do ar em porcentagem
float umidadeMin = 60.0;
float umidadeMax = 80.0;

// Luminosidade: leitura analogica do ESP32 (0 a 4095)
int luminosidadeMin = 0;
int luminosidadeMax = 1229;

// ---------------- CONTROLE DE ALERTAS ----------------

bool alertaTemperatura = false;
bool alertaUmidade = false;
bool alertaLuminosidade = false;

bool ledLigado = false;

unsigned long ultimoPisca = 0;
unsigned long ultimaLeitura = 0;
unsigned long ultimoSom = 0;

// Intervalo de leitura: definido no setup() a partir do minimo do sensor
// (dht.getMinimumSamplingPeriod(): ~1 s no DHT11, ~2 s no DHT22)
unsigned long intervaloLeitura = 2000;
const unsigned long INTERVALO_PISCA = 350;

// Evita repetir o mesmo alerta sonoro continuamente
String ultimoAlertaSonoro = "";

// ---------------- CONTROLE REMOTO DOS ATUADORES ----------------

// LED: AUTO segue os alertas; ON / OFF forcam o estado via comando
enum ModoLed { LED_AUTO, LED_ON, LED_OFF };
ModoLed ledModo = LED_AUTO;

// Buzzer: forcado (tom continuo) ou silenciado ate o fim da anomalia atual
bool buzzerForcado = false;
bool buzzerSilenciado = false;

// ---------------- ALERTA SONORO SEM delay() ----------------
// Sequencia de tons: o primeiro toca em emitirSom(), os demais em
// atualizarSom(), espaçados por somPeriodo (mesmos tempos do codigo original).

int somFreq = 0;
int somDuracao = 0;
unsigned long somPeriodo = 0;
int somRestantes = 0;
unsigned long somProximo = 0;

// ---------------- ESTADO DA CONEXAO / FIWARE ----------------

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

// Topicos UltraLight 2.0 (montados no setup)
char topicAttrsBase[TAM_TOPICO];  // /<apikey>/<device_id>/attrs
char topicCmd[TAM_TOPICO];        // /<apikey>/<device_id>/cmd
char topicCmdexe[TAM_TOPICO];     // /<apikey>/<device_id>/cmdexe
char clientId[TAM_CLIENT_ID];
bool comunicacaoPronta = false;   // topicos, clientId e buffer montados no setup

unsigned long ultimaTentativaWifi = 0;
bool primeiraTentativaWifi = true;
bool wifiConectadoAnterior = false;
unsigned long ultimaTentativaMqtt = 0;
bool primeiraTentativaMqtt = true;

unsigned long ultimaPubSensores = 0;
unsigned long ultimaPubEstado = 0;
bool ultimoEstadoPublicado = false;

// Ultimas leituras validas (para publicacao)
float ultimaTemperatura = 0;
float ultimaUmidade = 0;
int ultimaLuminosidade = 0;
bool dhtValido = false;          // ultima leitura do DHT foi valida?
bool luminosidadeValida = false; // LDR ja foi lido ao menos uma vez?

// ---------------- WIFI ----------------

// NAO bloqueante: no maximo uma tentativa por INTERVALO_RECONEXAO_WIFI.
// Chamada a cada volta do loop; so age enquanto nao ha conexao.
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  // (agora - anterior) >= intervalo continua correto quando millis() da a volta
  if (!primeiraTentativaWifi &&
      millis() - ultimaTentativaWifi < INTERVALO_RECONEXAO_WIFI) {
    return;
  }

  primeiraTentativaWifi = false;
  ultimaTentativaWifi = millis();

  Serial.print("WiFi: conectando a ");
  Serial.print(WIFI_SSID);
  Serial.print(" (status antes=");
  Serial.print((int)WiFi.status());
  Serial.println(")");

  // Descarta uma associacao pendente para recomecar limpo
  WiFi.disconnect();
  wl_status_t status = WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("WiFi: begin status=");
  Serial.println((int)status);
}

// ---------------- MQTT ----------------

// Monta /<apikey>/<device_id>/<sufixo>; false se nao couber no buffer
bool montarTopico(char *destino, size_t tamanho, const char *sufixo) {
  int n = snprintf(destino, tamanho, "/%s/%s/%s", APIKEY, DEVICE_ID, sufixo);

  if (n < 0 || (size_t)n >= tamanho) {
    Serial.print("MQTT: ERRO topico truncado: ");
    Serial.println(sufixo);
    return false;
  }

  return true;
}

// Publica no broker e registra no Serial ("->") o retorno do publish
bool publicar(const char *topico, const char *payload) {
  if (!mqtt.connected()) return false;

  bool ok = mqtt.publish(topico, payload);

  Serial.print("-> ");
  Serial.print(topico);
  Serial.print(" ");
  Serial.print(payload);
  Serial.print(ok ? " (true)" : " (false, state=");
  if (!ok) {
    Serial.print(mqtt.state());
    Serial.print(")");
  }
  Serial.println();

  return ok;
}

// Publica um atributo em /<apikey>/<device_id>/attrs/<atributo> (valor puro)
bool publicarAtributo(const char *atributo, const char *valor) {
  char topico[TAM_TOPICO];

  int n = snprintf(topico, sizeof(topico), "%s/%s", topicAttrsBase, atributo);
  if (n < 0 || (size_t)n >= sizeof(topico)) {
    Serial.println("MQTT: ERRO topico de atributo truncado");
    return false;
  }

  return publicar(topico, valor);
}

// Formata temperatura / umidade conforme a resolucao do sensor
void formatarDht(float valor, char *destino, size_t tamanho) {
  snprintf(destino, tamanho, "%.*f", DHT_CASAS_DECIMAIS, valor);
}

// Publica t, h e l, um atributo por vez (apenas leituras validas)
void publicarSensores() {
  char valor[TAM_VALOR];

  if (dhtValido) {
    formatarDht(ultimaTemperatura, valor, sizeof(valor));
    publicarAtributo("t", valor);

    formatarDht(ultimaUmidade, valor, sizeof(valor));
    publicarAtributo("h", valor);
  }

  if (luminosidadeValida) {
    snprintf(valor, sizeof(valor), "%d", ultimaLuminosidade);
    publicarAtributo("l", valor);
  }

  // Atualiza o relogio mesmo se falhar: a nova tentativa vem no proximo intervalo
  ultimaPubSensores = millis();
}

// Estado dos atuadores: "on" se buzzer ou LED estao acionados
bool existeAlerta() {
  return alertaTemperatura || alertaUmidade || alertaLuminosidade;
}

bool atuadoresAtivos() {
  bool alerta = existeAlerta();

  bool buzzerAtivo = buzzerForcado || (alerta && !buzzerSilenciado);
  bool ledAtivo = (ledModo == LED_ON) || (ledModo == LED_AUTO && alerta);

  return buzzerAtivo || ledAtivo;
}

// Publica o estado dos atuadores no formato "chave|valor"
void publicarEstado() {
  bool estado = atuadoresAtivos();
  char payload[TAM_VALOR];

  snprintf(payload, sizeof(payload), "s|%s", estado ? "on" : "off");
  publicar(topicAttrsBase, payload);

  // Atualiza mesmo se falhar, para nao tentar a cada volta do loop;
  // o periodico (INTERVALO_PUB_ESTADO) repete
  ultimoEstadoPublicado = estado;
  ultimaPubEstado = millis();
}

// Remove espacos das pontas (in place) e devolve o inicio do texto
char *aparar(char *texto) {
  while (*texto != '\0' && isspace((unsigned char)*texto)) texto++;

  size_t n = strlen(texto);
  while (n > 0 && isspace((unsigned char)texto[n - 1])) {
    texto[--n] = '\0';
  }

  return texto;
}

// Executa o comando recebido; retorna false se for desconhecido
bool executarComando(const char *cmd, const char *params) {
  if (strcmp(cmd, "buzzer_on") == 0) {
    buzzerForcado = true;
    buzzerSilenciado = false;
    somRestantes = 0;
    tone(BUZZER, 2000);  // tom continuo
    return true;
  }

  if (strcmp(cmd, "buzzer_off") == 0) {
    buzzerForcado = false;
    noTone(BUZZER);
    somRestantes = 0;
    ultimoAlertaSonoro = "";
    // Silencia o alerta sonoro ate a anomalia atual terminar
    if (existeAlerta()) buzzerSilenciado = true;
    return true;
  }

  // "on" / "off" sao aceitos como led_on / led_off (compatibilidade Smart Lamp)
  if (strcmp(cmd, "led_on") == 0 || strcmp(cmd, "on") == 0) {
    ledModo = LED_ON;
    return true;
  }

  if (strcmp(cmd, "led_off") == 0 || strcmp(cmd, "off") == 0) {
    ledModo = LED_OFF;
    return true;
  }

  if (strcmp(cmd, "led_auto") == 0) {
    ledModo = LED_AUTO;
    return true;
  }

  // Comando generico: led|on, led|off ou led|auto
  if (strcmp(cmd, "led") == 0) {
    if (strcmp(params, "on") == 0)   { ledModo = LED_ON;   return true; }
    if (strcmp(params, "off") == 0)  { ledModo = LED_OFF;  return true; }
    if (strcmp(params, "auto") == 0) { ledModo = LED_AUTO; return true; }
    return false;
  }

  return false;
}

// Callback de mensagens recebidas: "<device_id>@<comando>|<parametros>"
void onMessage(char *topico, byte *payload, unsigned int length) {
  char msg[TAM_MENSAGEM_CMD];

  // Valida o tamanho antes de copiar (o payload nao termina em '\0')
  if (length == 0 || length >= sizeof(msg)) {
    Serial.print("<- ");
    Serial.print(topico);
    Serial.print(" descartada, tamanho invalido: ");
    Serial.println(length);
    return;
  }

  memcpy(msg, payload, length);
  msg[length] = '\0';

  Serial.print("<- ");
  Serial.print(topico);
  Serial.print(" ");
  Serial.println(msg);

  char *arroba = strchr(msg, '@');
  if (arroba == NULL) return;
  *arroba = '\0';

  // Ignora comandos destinados a outro device_id
  if (strcmp(aparar(msg), DEVICE_ID) != 0) {
    Serial.println("<- ignorado: device_id diferente");
    return;
  }

  char *cmd = arroba + 1;
  char *params = strchr(cmd, '|');
  if (params != NULL) {
    *params = '\0';
    params++;
  } else {
    params = cmd + strlen(cmd);  // sem '|': parametros vazios
  }

  cmd = aparar(cmd);
  params = aparar(params);

  bool ok = executarComando(cmd, params);

  // Confirma o comando e depois republica o estado
  char confirmacao[TAM_PAYLOAD];
  int n = snprintf(confirmacao, sizeof(confirmacao), "%s@%s|%s",
                   DEVICE_ID, cmd, ok ? "ok" : "unknown command");
  if (n < 0 || (size_t)n >= sizeof(confirmacao)) {
    Serial.println("MQTT: ERRO confirmacao truncada");
  } else {
    publicar(topicCmdexe, confirmacao);
  }

  // Aplica o novo estado imediatamente antes de reportar
  controlarAlertas();
  publicarEstado();
}

// NAO bloqueante: no maximo uma tentativa por INTERVALO_RECONEXAO
void connectMqtt() {
  if (mqtt.connected()) return;

  if (!primeiraTentativaMqtt &&
      millis() - ultimaTentativaMqtt < INTERVALO_RECONEXAO) {
    return;
  }

  primeiraTentativaMqtt = false;
  ultimaTentativaMqtt = millis();

  Serial.print("MQTT: conectando a ");
  Serial.print(MQTT_BROKER);
  Serial.print(":");
  Serial.println(MQTT_PORT);

  bool conectou;
  if (strlen(MQTT_USER) > 0) {
    conectou = mqtt.connect(clientId, MQTT_USER, MQTT_PASSWORD);
  } else {
    conectou = mqtt.connect(clientId);
  }

  if (!conectou) {
    Serial.print("MQTT: falhou, state=");
    Serial.println(mqtt.state());
    return;
  }

  Serial.println("MQTT: conectado");

  if (!mqtt.subscribe(topicCmd)) {
    // Sem a assinatura de cmd o device nao recebe comandos: tenta de novo
    Serial.print("MQTT: subscribe falhou, state=");
    Serial.println(mqtt.state());
    mqtt.disconnect();
    return;
  }
  Serial.print("-> subscribe ");
  Serial.println(topicCmd);

  // Ao conectar, publica estado e leituras atuais
  publicarEstado();
  publicarSensores();
}

// Mantem WiFi e MQTT no ar sem bloquear o loop
void manterConexoes() {
  connectWiFi();

  bool wifiConectado = (WiFi.status() == WL_CONNECTED);
  if (wifiConectado != wifiConectadoAnterior) {
    wifiConectadoAnterior = wifiConectado;
    if (wifiConectado) {
      Serial.print("WiFi: conectado, IP ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("WiFi: conexao perdida");
    }
  }

  if (!wifiConectado || !comunicacaoPronta) return;

  connectMqtt();

  if (mqtt.connected() && !mqtt.loop()) {
    Serial.print("MQTT: conexao perdida, state=");
    Serial.println(mqtt.state());
  }
}

// ---------------- CONFIGURACAO ----------------

void setup() {
  Serial.begin(115200);

  pinMode(LED_AZUL, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  pinMode(LDR_PIN, INPUT);

  digitalWrite(LED_AZUL, LOW);
  noTone(BUZZER);

  // Inicializa o sensor DHT (tipo definido em DHT_TYPE)
  dht.setup(DHT_PIN, DHT_TYPE);

  // Respeita o periodo minimo de amostragem do sensor
  intervaloLeitura = dht.getMinimumSamplingPeriod();

  // Resolucao do conversor analogico
  analogReadResolution(12);

  Serial.println("==================================");
  Serial.println("       VINHERIA SENSE");
  Serial.println(" Monitoramento inteligente IoT");
  Serial.println("==================================");

  Serial.println("Sistema iniciado!");

  // Topicos UltraLight 2.0, sempre montados a partir de APIKEY e DEVICE_ID
  bool topicosOk =
    montarTopico(topicAttrsBase, sizeof(topicAttrsBase), "attrs") &&
    montarTopico(topicCmd, sizeof(topicCmd), "cmd") &&
    montarTopico(topicCmdexe, sizeof(topicCmdexe), "cmdexe");

  // clientId unico por placa: fiware-<DEVICE_ID>-<MAC do efuse em hex>
  uint64_t mac = ESP.getEfuseMac();
  int tamClientId = snprintf(clientId, sizeof(clientId), "fiware-%s-%04X%08X",
                             DEVICE_ID, (unsigned int)(mac >> 32), (unsigned int)mac);
  bool clientIdOk = (tamClientId > 0 && (size_t)tamClientId < sizeof(clientId));
  Serial.print("MQTT clientId: ");
  Serial.println(clientId);

  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(onMessage);
  mqtt.setSocketTimeout(MQTT_TIMEOUT_S);

  // Sem isto o PubSubClient descarta publicacoes que nao cabem no buffer
  bool bufferOk = mqtt.setBufferSize(MQTT_BUFFER_BYTES);
  if (!bufferOk) Serial.println("MQTT: ERRO setBufferSize");

  comunicacaoPronta = topicosOk && clientIdOk && bufferOk;
  if (!comunicacaoPronta) Serial.println("MQTT: ERRO na montagem, comunicacao desativada");

  // Primeira tentativa de WiFi (nao bloqueia; o loop repete a cada intervalo)
  WiFi.mode(WIFI_STA);
  connectWiFi();

  Serial.println("Aguardando leitura dos sensores...");
  Serial.println();
}

// ---------------- LEITURA DOS SENSORES ----------------

void lerSensores() {
  TempAndHumidity dados = dht.getTempAndHumidity();

  float temperatura = dados.temperature;
  float umidade = dados.humidity;

  int luminosidade = analogRead(LDR_PIN);

  ultimaLuminosidade = luminosidade;
  luminosidadeValida = true;

  // Verifica se a leitura do DHT e valida
  if (dht.getStatus() != DHTesp::ERROR_NONE ||
      isnan(temperatura) || isnan(umidade)) {
    dhtValido = false;
    Serial.print("ERRO: Falha na leitura do DHT: ");
    Serial.println(dht.getStatusString());
    return;
  }

  ultimaTemperatura = temperatura;
  ultimaUmidade = umidade;
  dhtValido = true;

  // Verifica temperatura
  alertaTemperatura =
    (temperatura < temperaturaMin ||
     temperatura > temperaturaMax);

  // Verifica umidade
  alertaUmidade =
    (umidade < umidadeMin ||
     umidade > umidadeMax);

  // Verifica luminosidade
  alertaLuminosidade =
    (luminosidade < luminosidadeMin ||
     luminosidade > luminosidadeMax);

  // Exibe os dados no monitor serial
  Serial.println("----------------------------------");

  Serial.print("Temperatura: ");
  Serial.print(temperatura, 1);
  Serial.println(" C");

  Serial.print("Umidade: ");
  Serial.print(umidade, 1);
  Serial.println(" %");

  Serial.print("Luminosidade: ");
  Serial.println(luminosidade);

  Serial.println("----------------------------------");

  // Exibe os alertas ativos
  if (alertaTemperatura) {
    Serial.println("ALERTA: TEMPERATURA FORA DO LIMITE!");
  }

  if (alertaUmidade) {
    Serial.println("ALERTA: UMIDADE FORA DO LIMITE!");
  }

  if (alertaLuminosidade) {
    Serial.println("ALERTA: LUMINOSIDADE FORA DO LIMITE!");
  }

  if (!alertaTemperatura &&
      !alertaUmidade &&
      !alertaLuminosidade) {
    Serial.println("STATUS: AMBIENTE NORMAL");
  }

  Serial.println();

  // Controla os alertas visuais e sonoros
  controlarAlertas();
}

// ---------------- CONTROLE DOS ALERTAS ----------------

void controlarAlertas() {
  bool alerta = existeAlerta();

  // Fim da anomalia: o silenciamento do buzzer deixa de valer
  if (!alerta) {
    buzzerSilenciado = false;
  }

  // ----- LED -----
  if (ledModo == LED_ON) {
    // Comando remoto: LED fixo aceso
    digitalWrite(LED_AZUL, HIGH);
    ledLigado = true;
  }
  else if (ledModo == LED_OFF) {
    // Comando remoto: LED apagado
    digitalWrite(LED_AZUL, LOW);
    ledLigado = false;
  }
  else if (alerta) {
    // Se existir uma anomalia, o LED pisca
    if (millis() - ultimoPisca >= INTERVALO_PISCA) {
      ultimoPisca = millis();

      ledLigado = !ledLigado;

      digitalWrite(LED_AZUL, ledLigado);
    }
  }
  else {
    // Ambiente normal: desliga o LED
    digitalWrite(LED_AZUL, LOW);
    ledLigado = false;
  }

  // ----- BUZZER -----
  if (buzzerForcado) {
    // Comando remoto: tom continuo ja iniciado, nada a fazer
    return;
  }

  if (alerta && !buzzerSilenciado) {
    // Prioridade para temperatura, depois umidade,
    // depois luminosidade.
    String alertaAtual;

    if (alertaTemperatura) {
      alertaAtual = "TEMPERATURA";
    }
    else if (alertaUmidade) {
      alertaAtual = "UMIDADE";
    }
    else {
      alertaAtual = "LUMINOSIDADE";
    }

    // Emite um novo padrao sonoro quando o tipo
    // de alerta muda ou quando o intervalo termina.
    if (alertaAtual != ultimoAlertaSonoro ||
        millis() - ultimoSom >= 1800) {

      emitirSom(alertaAtual);

      ultimoAlertaSonoro = alertaAtual;
      ultimoSom = millis();
    }
  }
  else {
    // Sem alerta (ou silenciado): desliga o som
    noTone(BUZZER);
    somRestantes = 0;

    ultimoAlertaSonoro = "";
  }
}

// ---------------- ALERTAS SONOROS ----------------

// Inicia o padrao sonoro; os tons seguintes saem em atualizarSom()
void emitirSom(String tipo) {
  noTone(BUZZER);

  if (tipo == "TEMPERATURA") {
    // Dois sons medios: temperatura
    somFreq = 1800;
    somDuracao = 180;
    somPeriodo = 220;
    somRestantes = 2;

    Serial.println("Alerta sonoro: TEMPERATURA");
  }

  else if (tipo == "UMIDADE") {
    // Um som longo: umidade
    somFreq = 1000;
    somDuracao = 500;
    somPeriodo = 500;
    somRestantes = 1;

    Serial.println("Alerta sonoro: UMIDADE");
  }

  else if (tipo == "LUMINOSIDADE") {
    // Tres sons curtos: luminosidade
    somFreq = 2400;
    somDuracao = 100;
    somPeriodo = 140;
    somRestantes = 3;

    Serial.println("Alerta sonoro: LUMINOSIDADE");
  }

  else {
    return;
  }

  // Primeiro tom imediato
  tone(BUZZER, somFreq, somDuracao);
  somRestantes--;
  somProximo = millis() + somPeriodo;
}

// Toca os tons restantes da sequencia no tempo certo (sem delay)
void atualizarSom() {
  if (somRestantes > 0 && millis() >= somProximo) {
    tone(BUZZER, somFreq, somDuracao);
    somRestantes--;
    somProximo += somPeriodo;
  }
}

// ---------------- LOOP PRINCIPAL ----------------

void loop() {
  // WiFi + MQTT (reconexao nao bloqueante e recebimento de comandos)
  manterConexoes();

  // Atualiza os sensores respeitando o periodo minimo do DHT
  if (millis() - ultimaLeitura >= intervaloLeitura) {
    ultimaLeitura = millis();

    lerSensores();
  }

  // Mantem o controle de alertas ativo entre leituras
  controlarAlertas();
  atualizarSom();

  // Publicacoes (somente com broker conectado)
  if (mqtt.connected()) {
    if (millis() - ultimaPubSensores >= INTERVALO_PUB_SENSORES) {
      publicarSensores();
    }

    // Estado dos atuadores: ao mudar e periodicamente
    if (atuadoresAtivos() != ultimoEstadoPublicado ||
        millis() - ultimaPubEstado >= INTERVALO_PUB_ESTADO) {
      publicarEstado();
    }
  }
}
