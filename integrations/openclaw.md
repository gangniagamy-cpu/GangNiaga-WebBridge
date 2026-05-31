# 🌐 OpenClaw & PUSPA-V4 Integration Guide

Dokumen ini menerangkan cara mengintegrasikan **GangNiaga WebBridge** Chrome Extension ke dalam pelantar ejen **OpenClaw** dan projek pengurusan NGO **PUSPA-V4** yang berjalan di server tempatan atau cloud.

---

## 🔧 1. Konfigurasi Fail `.env` Ejen

Untuk membolehkan ejen AI OpenClaw (seperti `openclaw/puspacare`) berkomunikasi dengan browser melalui GangNiaga WebBridge, pastikan pembolehubah persekitaran (environment variables) berikut ditetapkan pada fail `.env` projek ejen anda:

```bash
# URL Gateway OpenClaw yang menguruskan chat completions
OPENCLAW_GATEWAY_URL="https://operator.gangniaga.my"
OPENCLAW_GATEWAY_TOKEN="your_openclaw_access_token"

# Pautan Bridge WebSocket Lalai (jika menggunakan cloud relay)
OPENCLAW_BRIDGE_URL="https://operator.gangniaga.my/puspa-bridge"

# E2EE Secret Key (Jika anda mengaktifkan Zero-Trust Tunneling)
# Ini mestilah sama dengan kunci yang disetkan dalam Advanced Settings Popup Extension
OPENCLAW_E2EE_SECRET="your_shared_e2ee_secret_key"
```

---

## 🚀 2. Mengaktifkan Sambungan Ejen OpenClaw

### Pilihan A: Sambungan Tempatan (Local WebSocket Daemon)

1. Jalankan daemon OpenClaw tempatan pada port `10087`. Ejen akan membuka WebSocket server untuk menunggu extension menyambung.
2. Buka Chrome, klik ikon **GangNiaga WebBridge** dan pastikan status bertukar menjadi **Ready (Connected)**.
3. Ejen anda kini boleh memanggil tool automasi (seperti `click`, `fill`, atau `snapshot`) secara telus.

### Pilihan B: Sambungan Cloud Relay (Secure Bridge)

Jika ejen anda dihoskan di internet (cloud) dan anda mahu mengawal browser tempatan di laptop anda:

1. Buka **GangNiaga WebBridge Popup UI** di browser anda.
2. Buka **Advanced Settings** dan setkan URL WebSocket Cloud Relay:
   `wss://operator.gangniaga.my/puspa-bridge?secret=your_shared_e2ee_secret_key`
3. Klik **Save**. Sambungan tersulit AES-256-GCM akan diwujudkan secara automatik dari cloud ke laptop anda tanpa mendedahkan sebarang port IP awam!

---

## 🛠️ 3. Contoh Ejen Memanggil Tool (Tool Call Payload)

Apabila ejen OpenClaw mahu melakukan semakan maklumat asnaf di Shopee, ia akan menghantar payload berikut:

```json
{
  "type": "tool_call",
  "requestId": "req-shopee-check",
  "payload": {
    "name": "click",
    "args": {
      "selector": "input[placeholder='Cari barangan asnaf']"
    }
  }
}
```

Jika butang tersebut telah bertukar kelas CSS-nya, enjin **Self-Healing Selectors** dalam **GangNiaga WebBridge** akan auto-aktifkan Gemini Nano tempatan untuk membaiki klik tersebut secara automatik dan mengembalikan keputusan berjaya kepada OpenClaw!
