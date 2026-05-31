# 🦅 Hermes Agent & Python Integrations

Panduan ini menyediakan contoh kod dan tutorial lengkap untuk menyambungkan **GangNiaga WebBridge** Chrome Extension ke **Hermes-Agent** atau mana-mana ejen AI berasaskan **Python** (seperti LangChain, CrewAI, AutoGen, LlamaIndex).

---

## 🐍 1. Python WebSocket Daemon (Mock Server)

Ejen AI berasaskan Python boleh mengawal Chrome dengan bertindak sebagai WebSocket Server. Sila install library `websockets` terlebih dahulu:

```bash
pip install websockets
```

Kemudian, jalankan skrip Python di bawah untuk membina daemon tempatan pada port `10087`:

```python
# hermes_daemon.py
import asyncio
import json
import websockets

async def handle_client(websocket, path):
    print("[hermes] GangNiaga WebBridge Extension connected!")

    # 1. Hantar arahan navigasi ke Shopee selepas 2 saat
    await asyncio.sleep(2)
    navigate_cmd = {
        "type": "tool_call",
        "requestId": "req-1",
        "payload": {
            "name": "navigate",
            "args": {
                "url": "https://shopee.com.my",
                "newTab": True
            }
        }
    }
    print("[hermes] Sending navigation command to Shopee...")
    await websocket.send(json.dumps(navigate_cmd))

    # 2. Dengar maklumbalas daripada pelayar
    async for message in websocket:
        data = json.loads(message)
        print(f"[hermes] Received: {json.dumps(data, indent=2)}")

        # Contoh: Jika navigasi berjaya, jalankan carian asnaf
        if data.get("type") == "tool_result" and data.get("responseToRequestId") == "req-1":
            print("[hermes] Navigation complete. Requesting search fill...")
            await asyncio.sleep(1)
            fill_cmd = {
                "type": "tool_call",
                "requestId": "req-2",
                "payload": {
                    "name": "fill",
                    "args": {
                        "selector": "input.shopee-searchbar-input__input",
                        "value": "Keperluan Asas Asnaf"
                    }
                }
            }
            await websocket.send(json.dumps(fill_cmd))

async def main():
    async with websockets.serve(handle_client, "127.0.0.1", 10087, path="/ws"):
        print("[hermes] Server running on ws://127.0.0.1:10087/ws")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 🔒 2. Mengaktifkan Integrasi Enkripsi (E2EE AES-GCM) dalam Python

Untuk keselamatan Zero-Trust di mana skrip Python berada di cloud, anda boleh menggunakan modul `cryptography` Python untuk menyulitkan payload sebelum dihantar ke GangNiaga WebBridge.

Pastikan library cryptography dipasang:

```bash
pip install cryptography
```

Kod Python untuk encrypt/decrypt payload WebBridge:

```python
import base64
import os
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class E2EETunnel:
    def __init__(self, secret_key: str):
        # Hash key kepada 256-bit (32 bytes)
        self.key = hashlib.sha256(secret_key.encode()).digest()
        self.aesgcm = AESGCM(self.key)

    def encrypt(self, data_dict: dict) -> dict:
        plain_text = json.dumps(data_dict).encode('utf-8')
        iv = os.urandom(12)  # 12 bytes IV
        ciphertext = self.aesgcm.encrypt(iv, plain_text, None)

        # Gabungkan IV + Ciphertext (Web Crypto tag ada di akhir ciphertext secara terbina)
        combined = iv + ciphertext
        base64_data = base64.b64encode(combined).decode('utf-8')
        return {"encrypted": True, "data": base64_data}

    def decrypt(self, encrypted_dict: dict) -> dict:
        if not encrypted_dict.get("encrypted"):
            return encrypted_dict

        combined = base64.b64decode(encrypted_dict["data"])
        iv = combined[:12]
        ciphertext = combined[12:]

        decrypted = self.aesgcm.decrypt(iv, ciphertext, None)
        return json.loads(decrypted.decode('utf-8'))
```

Gunakan kelas `E2EETunnel` ini untuk memproses `websocket.send(tunnel.encrypt(cmd))` dan `tunnel.decrypt(message)` bagi menjamin kawalan pelayar web yang selamat.
