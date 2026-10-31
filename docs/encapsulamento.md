# Encapsulamento

Voltar ao [README](../README.md). Montagem elétrica em [manual-hardware.md](manual-hardware.md).


## Visão geral

| Peça | Função | STL |
|---|---|---|
| Caixa 1, base | Aloja ESP32, DHT11, LDR e buzzer | `encapsulamento/stl/Caixa1.stl` |
| Caixa 1, tampa | Fecha a caixa 1 e traz o logo de ovelha em relevo | `encapsulamento/stl/Caixa2.stl` |
| Caixa 2 | Guarda a mini protoboard e os fios. Aberta em cima, sem tampa | `encapsulamento/stl/Tampa.stl` |

A caixa 1 encaixa por cima da caixa 2.

## Justificativa de projeto

| Decisão | Motivo |
|---|---|
| Duas caixas | Separa a eletrônica de leitura (ESP32 e sensores) da protoboard e dos fios, e facilita a manutenção |
| Caixa 2 sem tampa | A caixa 1 funciona como tampa, então não é preciso uma terceira peça |
| Base e tampa separadas | Acesso ao ESP32 para gravar o firmware e trocar a fiação |
| Sem LED RGB | O alerta usa o LED azul do ESP32 (GPIO2), visto por um furo na tampa |
| Logo de ovelha em relevo | Identidade visual do grupo |

Pontos que a caixa precisa atender:

| Ponto | Como ficou no modelo |
|---|---|
| LEDs do ESP32 visíveis | A tampa tem furos de 3 mm, alinhados ao centro de cada LED da placa, inclusive o LED azul (GPIO2) que serve de alerta. Os furos ficam abertos, sem tubo de luz. Posição: medida a partir da borda do lado do USB e da lateral longa da placa. |
| Saída de som do buzzer | A tampa tem 7 furos de 1,5 mm sobre o buzzer, com 6 em círculo e 1 no centro. |
| DHT11 exposto ao ar da adega | O sensor fica em um bolso encostado em uma parede lateral, que tem fendas de ventilação de 1,5 mm. O ar de fora passa por elas até o sensor. |
| LDR voltado para a luz | A tampa tem uma janela de 6 mm sem grade, alinhada ao sensor, e um furo de 3,5 mm sobre o trimpot para ajustar a sensibilidade. |
| Cabo USB | Abertura de 14 x 9 mm com cantos arredondados, na parede curta, centralizada no conector micro-USB do ESP32. A altura considera os postes de apoio da placa. |

## Especificações

| Item | Valor |
|---|---|
| Software de modelagem | Onshape |
| Dimensões externas da caixa 1 | `93,3 mm x 55,6 mm x 36 mm` |
| Dimensões externas da caixa 2 | `96,3 mm x 58,6 mm x 24,5 mm` |
| Espessura da parede | `2 mm` |
| Material e filamento | `PLA, Azul e Preto` |
| Impressora e configurações | `Bambu Lab A1, bico de 0,4 mm, perfil 0,20 mm Standard no Bambu Studio, 3 paredes, preenchimento de 15%`  |
| Link do modelo no Onshape | [`Link do Projeto no Onshape`](https://cad.onshape.com/documents/2b447928cdd29182145fad49/w/c2487f0d8f7c2d867e561281/e/919c3ac3e17e337b0818eb34?renderMode=0&uiState=6ae4fa71fb83164bc0a2188c) |

## Montagem

1. Imprima as três peças a partir dos STLs.
2. Monte o circuito na mini protoboard conforme [manual-hardware.md](manual-hardware.md) e acomode a protoboard e os fios na caixa 2.
3. Fixe na base da caixa 1 o ESP32, o DHT11, o LDR e o buzzer, com o DHT11 e o LDR voltados para as aberturas. O ESP32 apoia em 4 postes e é preso por um pino em cada furo de canto da placa. O módulo LDR entra no bolso com o pino no furo de fixação e dois batentes laterais, e o DHT11 encaixa no bolso dele, junto à parede com as fendas. O buzzer entra no alojamento cilíndrico, preso pelos ressaltos. Se algum ficar folgado, use uma gota de cola quente.
4. Passe os fios entre as duas caixas pela passagem de 16 x 6 mm no piso da caixa 1, que abre direto na cavidade da caixa 2.
5. Encaixe a caixa 1 sobre a caixa 2.
6. Feche a tampa da caixa 1 e confira que o cabo USB alcança a porta do ESP32.
7. Ligue e confira o monitor serial e o dashboard.

## Evidências

| Arquivo | Legenda |
|---|---|
| `docs/imgs/prototipo/encapsulamento.png` | Caixa montada |
| `docs/imgs/prototipo/aberto.png` | Interior da caixa 1 e da caixa 2 |
| `docs/imgs/prototipo/onshape.png` | Modelo no Onshape |
