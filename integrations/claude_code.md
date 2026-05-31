# 🤖 Claude Code & IDE Integrations (Cursor / Codex)

Panduan ini menerangkan cara mengintegrasikan **GangNiaga WebBridge** Chrome Extension ke dalam persekitaran pembangun berasaskan IDE dan CLI seperti **Claude Code**, **Cursor**, dan **Codex**.

---

## 💻 1. Claude Code Integration

**Claude Code** adalah terminal CLI berkuasa AI yang dibina oleh Anthropic. Ia boleh melaksanakan tugasan tempatan termasuk menulis fail dan menjalankan command.

### Bagaimana Claude Code Mengawal Browser Anda:

1. Apabila anda meminta Claude Code melayari web (contoh: _"Fiddle with Shopee checkout page"_), Claude Code memerlukan ejen automasi.
2. Dengan menjalankan **GangNiaga WebBridge Daemon** (pada port `10087`), Claude Code boleh menghantar arahan CDP (Chrome DevTools Protocol) secara langsung ke pelayar Chrome anda melalui daemon tersebut.
3. Anda hanya perlu memastikan daemon berjalan di latar belakang:
   ```bash
   node /path/to/gangniaga-daemon.js
   ```
4. Claude Code akan mengesan sambungan tersebut dan boleh memicu navigasi, klik, carian, dan tangkapan skrin pelayar Chrome tempatan anda.

---

## 🎨 2. Cursor IDE Integration

**Cursor** adalah editor kod AI yang menyokong ejen bersepadu. Anda boleh membina **Custom System Prompt** di dalam tetapan Cursor (Settings -> Features -> Rules for AI) untuk membolehkan ejen Cursor menulis skrip automasi yang menghantar arahan terus ke GangNiaga WebBridge.

### Contoh System Rules untuk Cursor Agent:

Masukkan arahan berikut dalam Rules for AI anda:

> "You have access to a local browser automation bridge called **GangNiaga WebBridge** running on `ws://127.0.0.1:10087/ws`. When asked to inspect a webpage, you should write and execute Node.js scripts using the `ws` package to send JSON tool calls. The browser automation protocols and tool schemas are detailed in [integrations/README.md](file:///D:/GangNiaga-WebBridge/integrations/README.md)."

---

## 🧠 3. Panduan System Prompt untuk LLM (Ejen Pintar)

Jika anda menyuap (feed) keupayaan GangNiaga WebBridge ke dalam model AI (e.g. Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro) sebagai System Prompt, gunakan templat arahan di bawah:

```markdown
Anda adalah Ejen Automasi Browser. Anda berkomunikasi dengan browser pengguna melalui WebSocket Client.
Setiap tindakan mestilah dihantar dalam format JSON `tool_call` yang sah:

{
"type": "tool_call",
"requestId": "ID_RAWAK_UNIK",
"payload": {
"name": "NAMA_TOOL",
"args": { ... }
}
}

Senarai NAMA_TOOL yang disokong oleh GangNiaga WebBridge:

1. `navigate` (url, newTab) - Melayari url
2. `click` (selector) - Klik element (auto self-healing jika kelas berubah!)
3. `fill` (selector, value) - Mengisi input teks
4. `mouse_click` (selector) - Klik tetikus dengan Bézier curve (anti-bot)
5. `snapshot` - Mengambil pokok aksesibiliti (AX Tree)
6. `youtube_transcript` (tab_id) - Ekstrak transkrip video YouTube
7. `swarm_broadcast` (topic, message) - Kongsi data silang ejen/tab

Tunggu maklumbalas dalam bentuk `tool_result` sebelum melakukan tindakan seterusnya.
```

Dengan prompt ini, ejen AI anda boleh mengawal Chrome secara autonomi dengan keupayaan bypass anti-bot dan self-healing!
