# 🛡️ Guardian: Advanced Code Security & Architectural Governance

Guardian is a proactive development supervisor designed to enforce architectural standards and detect security vulnerabilities in real-time. By utilizing a dual-engine protocol, it ensures your codebase remains clean, safe, and aligned with your system design.

---

## 🚀 Quick Start

Get Guardian up and running in your local environment.

### 1. Prerequisites
- **Node.js** (v18+)
- **Rust** (v1.75+)
- **Tauri CLI**: `npm install -g @tauri-apps/cli`

### 2. Installation
```bash
git clone https://github.com/your-username/guardian.git
cd guardian
npm install
```

### 3. Configuration
Rename `.env.example` to `.env` and provide your API keys:
```bash
cp .env.example .env
```

### 4. Launch
```bash
npm run tauri dev
```

---

## ✨ Core Engines

### 🛡️ Sentry Engine
- **Active Monitoring**: Watches for anti-patterns and performance bottlenecks as you code.
- **Workflow Protection**: Automatically pauses cycles on critical violations to ensure immediate remediation.

### 🧠 Architect Intelligence
- **Context-Aware Analysis**: Deeply understands project structure and design intent.
- **Automated Fixes**: Generates verified patches that respect the existing system architecture.

---

## 🛠️ Tech Stack

- **Core**: Rust (Tauri) for high-performance system monitoring.
- **Frontend**: React + TypeScript with Tailwind CSS v4.
- **Animation**: Motion for seamless interface transitions.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request or open an issue for any bugs or feature requests.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
