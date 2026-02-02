# 🚀 MPlayer - The Visionary Media Player

MPlayer adalah aplikasi video player berbasis web yang dirancang dengan estetika **Visionary** yang premium, glassmorphic, dan fitur-fitur canggih yang memberikan pengalaman menonton yang imersif baik di desktop maupun mobile.

## ✨ Fitur Unggulan

-   **💎 Desain Premium**: Antarmuka glassmorphic dengan efek ambient glow yang dinamis mengikuti pergerakan mouse.
-   **🔌 Embed Mode**: Mendukung pemutaran via URL parameter (`?id=` & `url=` & `title=`).
-   **🔒 Lockeye System**: Fitur penguncian UI kelas atas untuk mencegah interaksi tidak sengaja saat menonton.
    -   **Anti-Exit**: Menahan tombol `Escape` di desktop agar tidak keluar dari mode fullscreen (Keyboard Lock API).
    -   **Mobile Lockdown**: Menonaktifkan gesture sistem, status bar, dan menjaga layar tetap menyala (Screen Wake Lock API).
    -   **Haptic Feedback**: Getaran pada perangkat dan icon saat mencoba interaksi ilegal dalam kondisi terkunci.
-   **📜 Server-Stored History**: Riwayat tontonan yang tersimpan aman di server (`embeds.json`), bukan hanya di browser.
-   **🎬 Hybrid Player**: Mendukung pemutaran file video langsung (MP4, MKV, dll) maupun iframe eksternal secara otomatis.
-   **🚀 Gesture Control**: Double-tap untuk skip, hold untuk 2x speed, dan navigasi keyboard yang intuitif.

## 🛠️ Tech Stack

-   **Backend**: Node.js, Express.js
-   **Frontend**: Vanilla JavaScript, Custom CSS (No frameworks)
-   **Dependencies**: `dotenv`, `fs-extra`, `multer`

## 🚀 Cara Instalasi

1. Clone repositori ini.
2. Jalankan perintah instalasi:
   ```bash
   npm install
   ```
3. Konfigurasi file `.env` (isi dengan path video dan password privat kamu).
4. Jalankan server:
   ```bash
   npm start
   ```
5. Buka di browser: `http://localhost:3000`

## ⌨️ Pintasan Keyboard

-   `L` : Mengunci / Membuka antarmuka (Lockeye).
-   `F` / `Enter` : Fullscreen.
-   `Space` : Play / Pause.
-   `M` : Mute / Unmute.
-   `Arrow Right` : Skip 10s (Hold untuk 2x Speed).
-   `Arrow Left` : Rewind 10s (Hold untuk Rewind cepat).
-   `0-9` : Seek persentase video.

---

**Developed with ❤️ by wjaya**
