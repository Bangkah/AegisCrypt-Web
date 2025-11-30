# 🛡️ AegisCrypt Web

**Professional Client-Side Encryption Suite**

AegisCrypt Web is a modern, high-performance encryption tool built with **React** and the **Web Crypto API**. It brings desktop-grade security (AES-256-GCM) to the browser, allowing users to encrypt and decrypt files and folders locally without data ever leaving their device.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Security](https://img.shields.io/badge/Security-AES--256--GCM-green)
![Platform](https://img.shields.io/badge/Platform-Web-orange)

---

## 🚀 Features

- **Zero-Knowledge Architecture**: All encryption happens in your browser's memory. No files are ever uploaded to a server.
- **Industry Standard Security**:
  - **Algorithm**: AES-256-GCM (Galois/Counter Mode).
  - **Key Derivation**: PBKDF2 with HMAC-SHA256 (100,000 iterations).
  - **Salt**: 16-byte cryptographically strong random salt.
  - **IV/Nonce**: 12-byte random initialization vector per file.
- **Modern UI/UX**:
  - Drag & Drop support.
  - Recursive folder processing.
  - Real-time operation logging.
  - Dark mode interface designed with Tailwind CSS.
- **Password Strength Meter**: Real-time feedback on password complexity.

---

## 🛠️ Technical Specifications

AegisCrypt uses the browser's native `window.crypto.subtle` API for maximum performance and security.

| Component | Specification | Description |
|-----------|--------------|-------------|
| **Encryption** | AES-GCM | 256-bit key length, 128-bit authentication tag. |
| **KDF** | PBKDF2 | Derives key from password. Uses SHA-256. |
| **Iterations** | 100,000 | Protects against brute-force attacks. |
| **Salt** | 16 Bytes | Randomly generated per file. |
| **IV** | 12 Bytes | Randomly generated per file to prevent pattern analysis. |

### Encrypted File Structure
The output `.enc` file follows this binary structure:
```text
[ Salt (16 bytes) ] + [ IV (12 bytes) ] + [ Ciphertext + Auth Tag ]
```

---

## 📦 Installation & Usage

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 1. Clone and Install
```bash
git clone https://github.com/Bangkah/AegisCrypt-Web.git
cd AegisCrypt-Web
npm install
```

### 2. Run Locally
```bash
npm start
# App will run at http://localhost:3000
```

### 3. Build for Production
```bash
npm run build
```

---

## 📂 Project Structure

```
src/
├── components/
│   ├── LogBox.tsx        # Terminal-style operation logger
│   └── PasswordInput.tsx # Secure input with strength meter
├── services/
│   └── cryptoService.ts  # Core Web Crypto API implementation
├── constants.ts          # Crypto constants (Iterations, Salt sizes)
├── types.ts              # TypeScript interfaces
├── App.tsx               # Main application controller
└── index.tsx             # Entry point
```

---

## 🔒 Security Notice

While this application uses industry-standard algorithms:
1.  **Forgot Password**: If you lose your password, **your data is lost forever**. There is no "reset" or "backdoor."
2.  **Browser Limitations**: Since this runs in the browser, extremely large files (e.g., >2GB) may hit browser memory limits depending on your hardware.

