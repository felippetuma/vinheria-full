# Alertas e triggers

Voltar ao [README](../README.md). Código de referência: `firmware/vinheria_full/vinheria_full.ino` e `dashboard/src/`.

## Anomalia, LED, buzzer e comando

| Anomalia | LED azul (GPIO2) | Buzzer (GPIO25) | Comando do front-end |
|---|---|---|---|
| Temperatura fora do trigger | Pisca a cada 350 ms | 2 bipes, 1800 Hz, 180 ms cada | `alertTemp` |
| Umidade fora do trigger | Pisca a cada 350 ms | 1 som longo, 1000 Hz, 500 ms | `alertHum` |
| Luminosidade fora do trigger | Pisca a cada 350 ms | 3 bipes curtos, 2400 Hz, 100 ms cada | `alertLum` |
| Tudo normal | Apagado | Silêncio | `alertOff` |

O padrão sonoro se repete a cada 1,8 s enquanto durar a anomalia. Com mais de uma anomalia, o LED pisca e o buzzer toca um padrão por vez, na ordem temperatura, umidade, luminosidade.

O LED é o LED azul embutido do DevKit V1. O projeto não usa LED RGB.

## Triggers

Há dois conjuntos de limites, com os mesmos valores por padrão. Editar um não altera o outro.

| Métrica | Triggers do app (padrão) | Limites do firmware | Observação |
|---|---|---|---|
| Temperatura | 10 a 30 °C (`AppProvider.tsx:15`) | 10,0 a 30,0 °C (`vinheria_full.ino:89-90`) | Iguais |
| Umidade | 60 a 80 % (`AppProvider.tsx:16`) | 60,0 a 80,0 % (`vinheria_full.ino:93-94`) | Iguais |
| Luminosidade | 0 a 40 % (`AppProvider.tsx:17`) | 0 a 40 % (`vinheria_full.ino:97-98`) | Iguais |

O que cada lado faz com os limites:
- No app: decide quando enviar `alertTemp`, `alertHum`, `alertLum` e `alertOff`. É editável na aba Triggers, mas só vale enquanto o app está aberto.
- No firmware: detecta anomalias por conta própria, mesmo sem o app, e liga LED e buzzer localmente. Só muda regravando o `.ino`.

Consequências:
1. Se vocês mudarem os triggers no app, o firmware continua usando os limites dele. Para que a demonstração seja coerente, altere as duas pontas com os mesmos valores.
2. O alerta remoto termina quando a leitura local volta ao normal pelos limites do firmware, ou quando chega `alertOff`.
3. Se o ambiente do laboratório estiver fora das faixas do firmware (por exemplo, 35 °C contra 10 a 30 °C), o alerta local fica ligado o tempo todo e o comportamento "normaliza e apaga" não aparece.

## Conversão da luminosidade

O ESP32 lê o LDR com o ADC de 12 bits (0 a 4095), faz a média de 16 leituras e converte para % (0 a 100) em `lerLuminosidadePct`. O firmware publica `l` já em %, e o app usa o valor sem conversão (`toValue` em `dashboard/src/lib/fiware.ts`). Gráficos, cartões e triggers do app trabalham em %. A direção do LDR (mais luz, valor maior ou menor) depende do módulo. Confirme no teste de bancada.

## Como o front-end aciona o alerta

1. A cada 5 s o app lê os valores atuais no Orion.
2. Compara cada valor com o trigger da métrica (`dashboard/src/app/index.tsx`).
3. Quando o conjunto de anomalias muda, envia `alertOff` e depois um comando por anomalia, por PATCH no Orion.
4. O Orion repassa ao IoT Agent, que publica em `/TEF/vinheria001/cmd` no formato `vinheria001@<comando>|`.
5. O ESP32 liga o alerta e responde em `/TEF/vinheria001/cmdexe` com `vinheria001@<comando>|ok`.
6. Quando tudo volta ao normal, o app envia `alertOff`.

O switch **Alertas automáticos** da aba Triggers liga e desliga esse envio. Os botões de teste manual na aba Dashboard enviam um comando direto.

## Outros comandos aceitos pelo firmware

| Comando | Efeito |
|---|---|
| `buzzer_on` | Tom contínuo de 2000 Hz |
| `buzzer_off` | Para o tom e silencia o buzzer até a anomalia atual acabar |
| `led_on`, `led_off`, `led_auto` (e `led\|on`, `led\|off`, `led\|auto`) | Força o LED aceso, apagado ou volta a seguir os alertas |
| `on`, `off` | Equivalem a `led_on` e `led_off` |

`led_on` e `led_off` têm prioridade sobre o pisca dos alertas.