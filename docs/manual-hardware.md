# Manual de hardware

Voltar ao [README](../README.md). Próximo passo: [manual-software.md](manual-software.md).

## Componentes

| Item | Quantidade | Observação |
|---|---|---|
| ESP32 DevKit V1 | 1 | LED azul embutido no GPIO2 |
| DHT11 | 1 | Hardware real. A simulação do Wokwi usa um DHT22 |
| Módulo LDR com saída analógica (AO) | 1 | |
| Buzzer | 1 | `Ativo`. O firmware usa `tone()` |
| Mini protoboard | 1 | |
| Fios jumper | 10 | |
| Cabo USB | 1 | Gravação e alimentação |

## Pinagem

| Sinal | GPIO do ESP32 | Constante no `.ino` |
|---|---|---|
| DHT, dados | 15 | `DHT_PIN` |
| LDR, saída analógica | 34 | `LDR_PIN` |
| LED azul (onboard) | 2 | `LED_AZUL` |
| Buzzer | 25 | `BUZZER` |

O GPIO34 só funciona como entrada, o que serve para o LDR.

## Ligações

Baseadas em `wokwi/diagram.json`:

| De | Para |
|---|---|
| ESP32 3V3 | Trilho positivo da protoboard, que alimenta o VCC do DHT e do LDR |
| ESP32 GND | Trilho negativo da protoboard, ligado ao GND do DHT, do LDR e do buzzer |
| DHT, dados | GPIO15 |
| LDR, AO | GPIO34 |
| Buzzer, terminal de sinal | GPIO25 |
| Buzzer, outro terminal | GND |

Confira antes de ligar:
- Se o DHT11 é módulo de 3 pinos ou componente de 4 pinos. O componente solto precisa de resistor de pull-up no pino de dados.
- A polaridade do buzzer, se ele for ativo.

## Gravação do firmware

Pré-requisitos:
- Arduino IDE 2.x.
- Pacote de placas ESP32 (Espressif), instalado em Ferramentas > Placa > Gerenciador de placas.
- Bibliotecas, instaladas pelo Gerenciador de Bibliotecas: `PubSubClient` (Nick O'Leary, versão 2.8 ou superior, por causa de `setBufferSize`) e `DHT sensor library for ESPx` (`DHTesp`).

Passos:

1. Abra `firmware/vinheria_full/vinheria_full.ino`.
2. Preencha as constantes de rede, sem versionar os valores reais:

   | Constante | Valor |
   |---|---|
   | `WIFI_SSID` | Nome da rede Wi-Fi |
   | `WIFI_PASSWORD` | Senha da rede |
   | `MQTT_BROKER` | IP público da EC2 |
   | `MQTT_PORT` | 1883 |
   | `APIKEY` | `TEF` |
   | `DEVICE_ID` | `vinheria001` |

3. Confirme `DHT_TYPE`: `DHTesp::DHT11` no hardware real, `DHTesp::DHT22` na simulação.
4. Em Ferramentas, escolha a placa **DOIT ESP32 Dev Kit V1** e a porta serial.
5. Clique em Carregar. Se a gravação falhar na conexão, segure o botão BOOT da placa até iniciar o upload.
6. Abra o Monitor Serial em 115200 baud.

Saída esperada:

```text
Sistema iniciado!
MQTT clientId: fiware-vinheria001-...
WiFi: conectado, IP ...
MQTT: conectado
-> subscribe /TEF/vinheria001/cmd
-> /TEF/vinheria001/attrs/t 23.0 (true)
```

## Limites do firmware

Os limites que disparam o alerta local ficam em `vinheria_full.ino`, nas linhas 89 a 98:

| Variável | Valor atual |
|---|---|
| `temperaturaMin` / `temperaturaMax` | 10,0 / 30,0 °C |
| `umidadeMin` / `umidadeMax` | 60,0 / 80,0 % |
| `luminosidadeMin` / `luminosidadeMax` | 0 / 40 (%) |

Se o ambiente do laboratório estiver fora dessas faixas, o alerta local fica ligado o tempo todo. Ajuste as constantes para o ambiente da demonstração e mantenha os triggers do app iguais. O DHT11 mede de 0 a 50 °C e de 20 a 90 % de umidade.

## Encapsulamento

Instruções de montagem da caixa em [encapsulamento.md](encapsulamento.md).
