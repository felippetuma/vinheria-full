# Manual de software

Voltar ao [README](../README.md). Antes deste manual: [manual-hardware.md](manual-hardware.md).

Os comandos usam `<IP_DA_EC2>` para o IP público da instância. Não grave senhas nem tokens em arquivos versionados.

## 1. Instância na AWS

| Item | Valor |
|---|---|
| Sistema | Ubuntu Server LTS |
| Mínimo | 1 vCPU, 1 GB de RAM, 20 GB de disco |

Regras de entrada do grupo de segurança:

| Porta | Serviço | Origem |
|---|---|---|
| 22 | SSH | Seu IP |
| 1883 | Mosquitto (ESP32) | IPs do grupo e do laboratório |
| 4041 | IoT Agent, via Nginx (app) | IPs do grupo |
| 8666 | STH-Comet, via Nginx (app) | IPs do grupo |
| 1026 | Orion (app) | IPs do grupo |

Não abra a 27017 (MongoDB). Para o Wokwi funcionar, a 1883 precisa estar acessível pela internet, porque a simulação roda na nuvem.

## 2. Subir o FIWARE

```bash
sudo apt update
sudo apt install docker.io docker-compose
git clone https://github.com/felippetuma/vinheria-full
cd vinheria-full/fireware
```

O Mosquitto lê a configuração de `fireware/mosquitto/mosquitto.conf`. O compose monta esse arquivo em `/mosquitto/config/mosquitto.conf` (`fireware/docker-compose.yml:76`, caminho relativo à pasta do compose), então rode os comandos de dentro de `fireware/`. Sem o arquivo no lugar, o Docker cria uma pasta com esse nome e o broker não sobe.

O arquivo atual abre a porta 1883 (MQTT) com `allow_anonymous true`, ou seja, sem usuário e senha, e a 9001 (WebSocket). O compose publica as duas, mas o projeto só usa a 1883. As mensagens do broker vão para o log do container.

Em seguida suba a stack:

```bash
sudo docker-compose up -d
sudo docker-compose ps
```

Todos os containers devem aparecer como `Up`. O compose atual traz um usuário e senha do MongoDB direto no arquivo. Troque por valores próprios na sua instância e não envie a troca ao repositório público.

Verifique o Mosquitto: o log deve mostrar o listener da porta 1883, e uma publicação de teste deve chegar a um assinante (os comandos `mosquitto_sub` e `mosquitto_pub` vêm do pacote `mosquitto-clients`).

```bash
sudo docker logs fiware-mosquitto
mosquitto_sub -h <IP_DA_EC2> -t "teste" -C 1 &
mosquitto_pub -h <IP_DA_EC2> -t "teste" -m "ok"
```

Verifique os demais serviços:

```bash
curl -s http://<IP_DA_EC2>:1026/version
curl -s http://<IP_DA_EC2>:4041/iot/about
curl -s http://<IP_DA_EC2>:8666/version
```

Encerrar e reiniciar:

```bash
sudo docker-compose down
sudo docker-compose up -d
```

Os dados ficam em volumes e sobrevivem ao `down`.

## 3. Provisionar o service group

O IoT Agent só aceita mensagens MQTT de uma apikey conhecida. O firmware usa `TEF`, `fiware-service: smart` e `fiware-servicepath: /` (os mesmos padrões do dashboard).

```bash
curl -s -X POST "http://<IP_DA_EC2>:4041/iot/services" \
  -H "Content-Type: application/json" \
  -H "fiware-service: smart" \
  -H "fiware-servicepath: /" \
  -d '{
    "services": [{
      "apikey": "TEF",
      "cbroker": "http://orion:1026",
      "entity_type": "Vinheria",
      "resource": ""
    }]
  }'
```

Confira:

```bash
curl -s "http://<IP_DA_EC2>:4041/iot/services" \
  -H "fiware-service: smart" -H "fiware-servicepath: /"
```

Este passo não está automatizado no repositório. Valide a resposta na sua instância antes do hands-on.

## 4. Cadastrar o device pelo dashboard

1. Instale e rode o app (seção 5).
2. Na aba **Config**, informe o IP da EC2 e toque em **Salvar e testar conexão**. Os três serviços devem aparecer com ✓.
3. Na aba **Dispositivos**, digite `001` e toque em **Cadastrar dispositivo**.

O app cria:

| Campo | Valor para o ID `001` |
|---|---|
| `device_id` | `vinheria001` |
| `entity_name` | `urn:ngsi-ld:Vinheria:001` |
| `entity_type` | `Vinheria` |
| Atributos | `t`→`temperature`, `h`→`humidity`, `l`→`luminosity` |
| Comandos | `alertTemp`, `alertHum`, `alertLum`, `alertOff` |
| Subscription | Orion notifica o STH-Comet a cada mudança |

O `device_id` precisa ser igual a `DEVICE_ID` do firmware (`vinheria001`). O ID digitado no app define esse nome.

O app não cadastra o atributo `s` (estado dos atuadores) que o firmware publica. O efeito disso no IoT Agent não foi verificado: confira na primeira conexão se as mensagens de `s` geram erro no log do IoT Agent (`sudo docker logs fiware-iot-agent`). Veja [conformidade-cp5.md](conformidade-cp5.md).

Não crie uma segunda subscription para a mesma entidade (por exemplo, pelo Postman). O histórico passaria a gravar pontos duplicados.

## 5. Dashboard

Pré-requisitos: Node.js 18 ou superior, app Expo Go no celular, e o celular e o computador na mesma rede Wi-Fi.

```bash
cd dashboard
npm install
npx expo start
```

Escaneie o QR Code com o Expo Go. Em outras situações:

```bash
npx expo start --tunnel   # QR Code não conecta
npx expo start -c         # limpar cache
npx expo start --web      # abrir no navegador (usa o CORS do Nginx)
```

Configure na aba Config:

| Campo | Valor |
|---|---|
| IP do FIWARE | IP público da EC2. Não use `localhost` |
| fiware-service | `smart` |
| fiware-servicepath | `/` |
| Tipo da entidade | `Vinheria` |
| URL de notificação do STH-Comet | `http://sth-comet:8666/notify` |

As configurações e os triggers ficam só em memória. Ao fechar o app, voltam aos padrões.

## 6. Verificar o fluxo

Telemetria: veja as mensagens chegando no broker (instale `mosquitto-clients` se necessário):

```bash
mosquitto_sub -h <IP_DA_EC2> -t "/TEF/#" -v
```

Valor atual no Orion:

```bash
curl -s "http://<IP_DA_EC2>:1026/v2/entities/urn:ngsi-ld:Vinheria:001?options=keyValues" \
  -H "fiware-service: smart" -H "fiware-servicepath: /"
```

Histórico no STH-Comet:

```bash
curl -s "http://<IP_DA_EC2>:8666/STH/v1/contextEntities/type/Vinheria/id/urn:ngsi-ld:Vinheria:001/attributes/temperature?lastN=5" \
  -H "fiware-service: smart" -H "fiware-servicepath: /"
```

Comando manual, sem o app:

```bash
curl -s -X PATCH "http://<IP_DA_EC2>:1026/v2/entities/urn:ngsi-ld:Vinheria:001/attrs" \
  -H "Content-Type: application/json" \
  -H "fiware-service: smart" -H "fiware-servicepath: /" \
  -d '{"alertTemp": {"type": "command", "value": ""}}'
```

No serial do ESP32 deve aparecer `<- /TEF/vinheria001/cmd vinheria001@alertTemp|` e depois `-> /TEF/vinheria001/cmdexe vinheria001@alertTemp|ok`.

## 7. Reset completo

Apaga entidades, subscriptions e todo o histórico.

```bash
sudo docker-compose down
sudo docker volume ls
sudo docker volume rm fireware_mongo-historical-data
sudo docker volume rm fireware_mongo-internal-data
```

O prefixo `fireware_` vem do nome da pasta do compose. Use o nome que o `docker volume ls` mostrar. Depois do reset, repita as seções 2 a 4.