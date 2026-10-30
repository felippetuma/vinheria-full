# Simulação no Wokwi

Voltar ao [README](../README.md).

| Item | Valor |
|---|---|
| Link do projeto | [`Link do Projeto no Wokwi`](https://wokwi.com/projects/479272509375634433) |
| Placa | ESP32 DevKit V1 |
| Sensores | LDR (`wokwi-photoresistor-sensor`) e DHT22 (`wokwi-dht22`) |
| Atuador | Buzzer. O LED azul é o LED embutido do ESP32 (GPIO2) |

## Ligações simuladas

Definidas em [`diagram.json`](diagram.json):

| Peça | Pino do ESP32 |
|---|---|
| DHT22, dados (SDA) | D15 |
| LDR, saída analógica (AO) | D34 |
| Buzzer | D25 |
| Alimentação | 3V3 e GND pela mini protoboard |

## Como rodar

1. Crie um projeto ESP32 no Wokwi e substitua o `diagram.json` pelo deste diretório.
2. Cole o conteúdo de `firmware/vinheria_full/vinheria_full.ino` no `sketch.ino`.
3. Em `libraries.txt`, use as bibliotecas `PubSubClient` e `DHTesp`.
4. No sketch, ajuste:

   | Constante | Valor na simulação |
   |---|---|
   | `DHT_TYPE` | `DHTesp::DHT22` (o repositório deixa `DHT11` para o hardware real) |
   | `WIFI_SSID` | `Wokwi-GUEST` |
   | `WIFI_PASSWORD` | vazio (`""`) |
   | `MQTT_BROKER` | IP público da EC2 |

5. Inicie a simulação e abra o monitor serial.

O Wokwi roda na nuvem, então a porta 1883 da EC2 precisa estar aberta para a internet durante a simulação.

## Pontos de atenção

- O `libraries.txt` do repositório lista `dhtESP32-rmt`, enquanto o sketch usa `DHTesp`. Ajuste para `DHTesp` no Wokwi. O diretório só documenta isso, não alterei o arquivo.
- Com o DHT22, o firmware publica 1 casa decimal (`DHT_CASAS_DECIMAIS` = 1).
- Para provocar alertas, mude temperatura, umidade e luz pelos controles dos sensores no Wokwi.
