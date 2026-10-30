# Vinheria Full – Dashboard Mobile (CP5)

Dashboard em React Native + Expo para monitorar temperatura, umidade e luminosidade de vinherias via FIWARE.

## Requisitos

- Node.js 18 ou superior
- App **Expo Go** no celular
- FIWARE rodando (IoT Agent 4041, Orion 1026, STH-Comet 8666)
- Celular e servidor FIWARE na **mesma rede Wi-Fi**

## Instalação

```bash
git clone (Repo URL)
cd Visionists-EdgeCP5
npm install
npx expo install react-native-svg @expo/vector-icons expo-status-bar
```

## Rodar

```bash
npx expo start
```

Escaneie o QR Code com o Expo Go.

## Lembretes

- Na aba **Config**, use o **IP da máquina** do FIWARE (não use `localhost`).
- `fiware-service` e `fiware-servicepath` do app devem ser iguais aos do Postman (padrão: `smart` e `/`).
- Se o QR Code não conectar: `npx expo start --tunnel`.
- Se der erro estranho de cache: `npx expo start -c`.
- Arquivos com JSX precisam ter extensão `.tsx`.
- Evite assinatura do STH-Comet duplicada (Postman + app), senão o histórico duplica os pontos.
- Comandos que o ESP32 precisa tratar: `alertTemp`, `alertHum`, `alertLum` e `alertOff`.
