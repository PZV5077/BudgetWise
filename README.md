# BudgetWise - Smart Personal Finance & AI Advisor

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)
![Express](https://img.shields.io/badge/Express-5.2-lightgrey.svg)
![License](https://img.shields.io/badge/license-ISC-blue.svg)

**BudgetWise** is a comprehensive, full-stack personal finance application designed to help users track expenses, manage budgets, and achieve financial goals. It features a robust backend architecture, secure authentication, and a built-in AI Financial Advisor powered by OpenAI.

---

## ✨ Features

### 🔐 Secure Authentication & User Isolation
* **JWT-Based Registration & Login**: Secure credential hashing using `bcryptjs`.
* **Industrial-Grade 2FA**: Fully integrated with **Duo Mobile** Universal SDK for enterprise-level Two-Factor Authentication.
* **Multi-Tenant Architecture**: Strict row-level data isolation ensures users can only access their own financial records.

### 💰 Comprehensive Financial Tracking (CRUD)
* **Transactions Management**: Add, update, delete, and categorize income and expenses.
* **Monthly Summaries**: Instant calculation of monthly income, expenses, and remaining balance.
* **Budgeting System**: Set overall monthly budgets or specific limits per category (e.g., Dining, Groceries, Transport).
* **Data Export**: Export transaction history to CSV format for external analysis.

### 🤖 AI Financial Advisor (OpenAI Integration)
* **Context-Aware AI**: The chatbot reads the user's recent spending history to provide highly personalized, data-driven financial advice.
* **Bilingual Support**: Capable of providing professional advice in both English and Chinese.
* **Fallback Mechanisms**: Ensures system stability even if the external LLM API is temporarily unavailable.

### 🏆 Gamification
* **365 Penny Challenge**: A built-in gamified savings tracker to encourage daily financial discipline.

---

## 🛠 Tech Stack

### Frontend (Client)
* **HTML5 / CSS3**: Responsive, modern, glassmorphism-inspired UI components.
* **Vanilla JavaScript (ES6+)**: Modular frontend architecture (`app.js`, `api.js`, `chat.js`).
* **Chart.js**: (Integrated) for visual financial representations.

### Backend (Server)
* **Node.js & Express (v5)**: High-performance RESTful API server.
* **SQLite (via `better-sqlite3`)**: Lightweight, zero-configuration local database (easily migratable to Cloud SQL).
* **Authentication**: `jsonwebtoken`, `bcryptjs`, `@duosecurity/duo_universal`.
* **AI Integration**: Official `openai` Node SDK.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
* **Node.js** (v18 or higher)
* **npm** (Node Package Manager)

### 2. Installation
Clone the repository and install the required dependencies:

```bash
# Navigate to the project directory
cd BudgetWise

# Install dependencies
npm install
```

### 3. Environment Configuration
Duplicate the `.env.example` file and rename it to `.env`. Fill in your secure keys:

```env
PORT=3000
JWT_SECRET=your_secure_jwt_secret

# Database Configuration (Defaults to SQLite for local development)
DB_TYPE=sqlite 

# OpenAI Integration
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-3.5-turbo

# Duo Mobile 2FA Configuration
DUO_ENABLED=true
DUO_CLIENT_ID=your_client_id
DUO_CLIENT_SECRET=your_client_secret
DUO_API_HOSTNAME=api-xxxx.duosecurity.com
```

### 4. Running the Server
Start the application in development mode:

```bash
npm run dev
```
The server will initialize the database schema automatically. Access the application at: **http://localhost:3000/login.html**

---

## ☁️ Cloud Database Migration

BudgetWise is designed with a Database Abstraction Layer (`server/config/db.js`), making it trivial to migrate from local SQLite to a production Cloud Database (e.g., AWS RDS, Aliyun RDS, MySQL, PostgreSQL).

1. Update the `.env` file with your cloud database credentials (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
2. Change `DB_TYPE=mysql` (or `postgres`).
3. Uncomment the cloud database connection logic in `db.js`. No changes to the business logic or controllers are required.

---

## 📂 Project Structure

```text
BudgetWise/
├── .env                  # Environment Variables
├── package.json          # Project Definition & Dependencies
├── server.js             # Express Server Entry Point
├── index.html            # Main Dashboard UI
├── login.html            # Authentication UI
├── css/                  # Stylesheets
├── js/                   # Frontend Logic (app.js, api.js, chat.js)
├── data/                 # Local SQLite Database Storage
└── server/               # Backend Architecture
    ├── config/           # Database (db.js) & Duo 2FA Configurations
    ├── middleware/       # JWT Auth & Security Middlewares
    ├── models/           # Data Models (User, Transaction, Budget, etc.)
    ├── routes/           # RESTful API Endpoints
    └── services/         # External Integrations (aiService.js)
```

## 📄 License
This project is licensed under the ISC License.