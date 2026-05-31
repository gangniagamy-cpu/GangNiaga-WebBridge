# ⚡ Panduan Lengkap A-Z: Cara Menggunakan GangNiaga WebBridge v2.5

Selamat datang ke manual rasmi GangNiaga WebBridge. Panduan dari A-Z ini direka khas untuk membantu pembangun dan ejen AI memahami, memasang, mengkonfigurasi, dan menyelesaikan masalah integrasi automasi pelayar web Chrome dari terminal Windows mahupun WSL Kali Linux/Ubuntu.

---

## 🧭 1. Pengenalan & Keunikan Projek

**GangNiaga WebBridge** ialah ejen perantara (_bridge daemon_) ringan yang membolehkan ejen kecerdasan buatan (seperti Hermes, Claude Desktop, Cursor, LangChain) mengawal pelayar Google Chrome sedia ada anda.

### Kenapa projek ini unik?

- **Akses Sesi Sah (Authenticated Session)**: Ia berjalan terus di atas profil Google Chrome anda yang aktif. Ejen AI tidak perlu log masuk semula atau melepasi sekatan OTP/2FA kerana ia menggunakan kuki dan sesi sedia ada anda.
- **Perisai Anti-Bot (Anti-Bot Shield)**: Ia melangkau pengesan bot standard (seperti Cloudflare, distil) dengan mensimulasikan pergerakan tetikus koordinat manusia sebenar dan meniru penayangan input React/Vue secara telus.
- **Dynamic WSL-to-Windows Routing**: Ejen AI di dalam WSL boleh berkomunikasi secara telus dengan daemon Windows tanpa isu perbezaan rangkaian maya.
- **Self-Healing Selectors**: Menggunakan kecerdasan buatan Gemini Nano terbina dalam Chrome untuk mencari komponen laman web yang berubah kelas/strukturnya dan membaiki konfigurasi secara automatik.

---

## 📋 2. Prasyarat Sistem

Sebelum memulakan pemasangan, pastikan komputer anda memenuhi keperluan berikut:

1. **Windows 10/11** dengan keupayaan **WSL 2** (jika anda mahu menggunakan ejen dari WSL Kali Linux/Ubuntu).
2. **Node.js v18 ke atas** dipasang pada Windows dan WSL (semak dengan `node -v`).
3. **Google Chrome** versi terkini yang dipasang di Windows.

---

## ⚙️ 3. Pemasangan & Konfigurasi Langkah demi Langkah (A-Z)

Ikuti langkah-langkah berikut secara teratur:

### Langkah 1: Pasang Chrome Extension (Windows)

1. Buka pelayar Google Chrome anda.
2. Pergi ke halaman pengurusan extension: `chrome://extensions/`.
3. Aktifkan **Developer mode** di bahagian atas sebelah kanan.
4. Klik butang **Load unpacked** di bahagian kiri atas.
5. Pilih folder berikut dari komputer anda: `D:\GangNiaga-WebBridge\extension`.
6. Extension **GangNiaga WebBridge** kini akan muncul pada bar barisan Chrome anda.

### Langkah 2: Daftar Native Messaging Host

Chrome memerlukan kebenaran khas untuk berinteraksi dengan program tempatan (daemon).

1. Buka folder `D:\GangNiaga-WebBridge`.
2. Klik kanan fail `install.bat` dan pilih **Run as Administrator** (atau klik dua kali).
3. Ini akan mendaftarkan Registry Key Chrome bagi membolehkan komunikasi Native Messaging berjalan dengan selamat.

### Langkah 3: Jalankan WebBridge Daemon (Windows)

1. Di dalam folder `D:\GangNiaga-WebBridge`, klik dua kali fail **`start.bat`**.
2. Skrip ini akan melakukan pemeriksaan automatik:
   - Mengesahkan Node.js dipasang.
   - Memasang modul NPM yang diperlukan (`node_modules`).
   - Menamatkan mana-mana daemon lama yang menyekat port `10087`.
   - Menjana fail pengesahan automatik `daemon/.webbridge-auth.json` (yang mengandungi API Key rawak).
   - Menjalankan daemon dalam tetingkap baharu dan melakukan pemeriksaan kesihatan (`🏥 Checking daemon health...`).
3. **PENTING**: Biarkan tetingkap terminal daemon ini sentiasa terbuka semasa anda menjalankan automasi.

### Langkah 4: Setup WSL Kali Linux / Ubuntu (Jika Guna WSL)

Ejen AI seperti Hermes biasanya dijalankan dalam persekitaran Linux WSL.

1. Buka terminal WSL Kali/Ubuntu anda.
2. Navigasi ke direktori projek yang dipautkan:
   ```bash
   cd /mnt/d/GangNiaga-WebBridge
   ```
3. Jalankan skrip setup automatik WSL:
   ```bash
   bash wsl-setup.sh
   ```
4. Muat semula profil terminal shell anda:
   ```bash
   source ~/.bashrc   # jika anda guna Bash
   # atau
   source ~/.zshrc    # jika anda guna Zsh
   ```
5. Ini akan mencipta alias `hermes-agent-aku` dan `hermes-agent-aku-i` (serta `Hermes-Agent-Aku` / `Hermes-Agent-Aku-i`) dalam WSL anda secara kekal.

> [!IMPORTANT]
> Alias ini dinamakan `hermes-agent-aku` dan bukannya `hermes` secara terus untuk memelihara kata kunci **`hermes`** bagi kegunaan Ejen AI rasmi Nous Research (`hermes chat`, `hermes setup`, dll.) agar tiada konflik arahan berlaku dalam shell WSL anda.

---

## 🖥️ 4. Panduan Menggunakan Dashboard / Popup Extension

Jika anda klik ikon **GangNiaga WebBridge** pada toolbar Chrome, popup menu akan dipaparkan.

### Memahami Status Sambungan

- **"Browser assistant is ready"**: Extension berjaya menyambung ke Daemon WebBridge di port `10087`.
- **"Browser assistant is not ready"**: Tiada sambungan. Ini berlaku jika:
  1. Daemon Windows tidak dijalankan.
  2. Service Worker ditidurkan (suspend) oleh Chrome semasa tiada kerja (rujuk bab _Troubleshooting_).

### Mod Pembangun (Developer Mode) dalam Popup

Sekiranya anda menggunakan WSL, adakalanya extension perlu diarahkan untuk mendengar IP Host Windows dan bukannya `127.0.0.1`.

1. Klik beberapa kali pada teks status atau logo di dalam popup untuk mengaktifkan **Advanced Settings**.
2. Masukkan alamat IP Gateway Windows anda (yang dipaparkan oleh skrip `wsl-start-daemon.sh` atau `ip route show default`).
3. Contoh: `ws://172.22.32.1:10087/ws`
4. Klik **Save & Reconnect**.

---

## 🦅 5. Cara Menjalankan Skrip Ejen Ujian (Hermes-Agent-Aku)

Terdapat dua cara utama untuk memulakan skrip ejen automasi ujian tempatan:

### Kaedah A: Mod Automatik (Default Test Workflow)

Sesuai untuk mengesahkan pemasangan berjalan 100% betul. Mod ini akan membuka tab Shopee, mencari komputer riba "Laptop", dan menangkap gambar skrin keputusan carian.

- **Dari WSL Kali/Ubuntu**:
  ```bash
  hermes-agent-aku
  ```
- **Dari CMD / PowerShell Windows**:
  ```powershell
  npm run hermes-agent-aku
  ```

### Kaedah B: Mod Interaktif (Interactive Console)

Sesuai untuk menguji arahan satu persatu secara langsung (_step-by-step_).

- **Dari WSL Kali/Ubuntu**:
  ```bash
  hermes-agent-aku-i
  ```
- **Dari CMD / PowerShell Windows**:
  ```powershell
  npm run hermes-agent-aku:interactive
  ```

**Arahan Konsol Interaktif:**

1. Taip `sites` untuk melihat senarai laman web yang disokong di dalam pengkalan pengetahuan (`D:\GangNiaga-WebBridge\daemon\sites\`).
2. Taip `load shopee.com.my` untuk memuatkan konfigurasi selector Shopee.
3. Taip `run` untuk memulakan skrip automasi ke atas laman web tersebut.
4. Taip `screenshot` untuk mengambil gambar skrin secara fizikal di Windows.
5. Taip `exit` untuk keluar.

---

## 🛠️ 6. Kamus Arahan Penuh (Command Action Suite API)

Apabila menulis ejen anda sendiri (rujuk [AGENTS.md](file:///D:/GangNiaga-WebBridge/AGENTS.md) untuk integrasi Python/Node.js), anda boleh menghantar arahan JSON berikut ke `POST http://localhost:10087/command` dengan parameter header `Authorization: Bearer <API_KEY>`:

| Arahan (`action`) | Parameter (`args`)                       | Huraian                                                                                  |
| :---------------- | :--------------------------------------- | :--------------------------------------------------------------------------------------- |
| `navigate`        | `{"url": "https://...", "newTab": true}` | Membuka laman web sasaran di tab aktif atau baharu.                                      |
| `click`           | `{"selector": "button#submit"}`          | Melakukan klik standard ke atas elemen DOM / CSS selector.                               |
| `mouse_click`     | `{"selector": "div.button"}`             | Melakukan pergerakan tetikus berbentuk lengkung rawak sebelum klik (melangkau anti-bot). |
| `fill`            | `{"selector": "input", "value": "text"}` | Mengisi input teks dengan selamat bagi framework reaktif.                                |
| `key_type`        | `{"text": "Hello World"}`                | Menaip teks aksara-demi-aksara dengan lengah masa realistik.                             |
| `send_keys`       | `{"keys": "Control+A"}`                  | Menghantar input butang pintasan papan kekunci (shortcuts).                              |
| `snapshot`        | `{}`                                     | Mengambil data pokok elemen (_Accessibility Tree - AXTree_).                             |
| `screenshot`      | `{"selector": "div#banner"}`             | Menangkap gambar kawasan elemen DOM terpilih.                                            |
| `os_screenshot`   | `{"path": "D:/image.png"}`               | Menangkap gambar keseluruhan monitor utama Windows (fizikal).                            |
| `os_click`        | `{"x": 100, "y": 200}`                   | Menolak kursor tetikus ke koordinat skrin Windows dan klik.                              |
| `hotkey`          | `{"keys": ["alt", "tab"]}`               | Melaksanakan hotkey sistem Windows (OS level).                                           |
| `save_as_pdf`     | `{"paper_format": "a4"}`                 | Menyimpan susun atur halaman aktif ke format fail PDF.                                   |

---

## 🆘 7. Penyelesaian Masalah (Troubleshooting A-Z)

### Masalah A: Ralat `... was unexpected at this time.` semasa menjalankan `start.bat`

- **Sebab**: Masalah sintaksis batch file pada versi terdahulu akibat aksara kurungan biasa `(PID %%a)` dalam gelung loop.
- **Penyelesaian**: Ralat ini telah dibaiki sepenuhnya pada versi 2.5.0 dengan menukarnya kepada `[PID %%a]`. Jika masih berlaku, pastikan anda menggunakan fail `start.bat` terbaharu daripada cawangan `main`.

### Masalah B: Ejen WSL Gagal Menghubungi Daemon (`Connection Refused` / `Timed Out`)

- **Sebab**: Ejen di dalam WSL gagal merutkan trafik rangkaian ke Windows Host.
- **Penyelesaian**:
  1. Pastikan Daemon berjalan di Windows (ada tetingkap `start.bat` terbuka).
  2. Buka fail `.env` di direktori projek dan kosongkan nilai `DAEMON_HOST=` supaya ejen menggunakan pengesan automatik IP Host.
  3. Sahkan sambungan secara manual dari WSL menggunakan arahan:
     ```bash
     curl -s http://$(ip route show default | awk '{print $3}'):10087/status
     ```
     Ia sepatutnya mengembalikan JSON status dengan selamat.

### Masalah C: Status Extension Menunjukkan "Disconnected" atau "Not Ready" Selepas Beberapa Ketika

- **Sebab**: Chrome menidurkan Extension Service Worker (`background.js`) selepas 30 saat tiada aktiviti (idle) untuk memelihara memori.
- **Penyelesaian**: **Tiada tindakan diperlukan.** Ini adalah had reka bentuk Manifest V3 Chrome. Apabila ejen menghantar arahan baru melalui daemon, Chrome akan mengejutkan semula Service Worker tersebut secara automatik untuk menjalankan tugasan.

### Masalah D: Ralat Port 10087 Sudah Digunakan (`EADDRINUSE`)

- **Sebab**: Terdapat saki-baki proses daemon lama yang masih berjalan di latar belakang Windows.
- **Penyelesaian**:
  1. Buka PowerShell Windows.
  2. Jalankan arahan:
     ```powershell
     powershell -File kill-daemons.ps1
     ```
  3. Mulakan semula `start.bat`.

---

_Manual ini diselenggara oleh GangNiaga AI Team. Sila rujuk [AGENTS.md](file:///D:/GangNiaga-WebBridge/AGENTS.md) untuk perincian penulisan skrip ejen automasi._
