# RoadGuard AI (Phase 1)

AI-powered pothole detection and segmentation using Roboflow's YOLOv11 Instance Segmentation model, structured as cleanly separated frontend and backend services.

---

## 📁 Project Architecture

```
C:\Pothole AI
├── frontend/                  # Standalone React + TypeScript + Vite Application
│   ├── src/
│   │   ├── components/        # Canvas overlay, results, error boundary
│   │   ├── services/          # API service layer (roboflow.ts)
│   │   ├── types/             # TypeScript type definitions
│   │   ├── App.tsx            # Main state machine & UI container
│   │   ├── App.css            # Styles
│   │   └── main.tsx           # React entry point
│   ├── index.html
│   ├── vite.config.ts         # Vite configuration with /api backend proxy
│   ├── tsconfig.json
│   ├── package.json
│   └── .gitignore
│
├── backend/                   # Standalone Node.js + Express + TypeScript API Server
│   ├── server/
│   │   └── index.ts           # Express endpoints & Roboflow YOLOv11 proxy
│   ├── test/
│   │   └── images/            # Preset sample road images for testing
│   ├── test-detection.ts      # Standalone integration test script
│   ├── tsconfig.json
│   ├── package.json
│   ├── .env                   # Roboflow API key (server-side only, never committed)
│   ├── .env.example
│   └── .gitignore
│
├── package.json               # Root helper scripts for concurrent execution
├── .gitignore
└── README.md
```

---

## 🔒 Security Architecture

The **Roboflow API key is stored strictly server-side** in `backend/.env` and is **never exposed to the browser or frontend bundle**. The frontend sends multipart image payloads to the local Express backend, which proxies inference requests to Roboflow and computes geometric severity metrics before returning the enriched results.

---

## 🚀 Getting Started

### 1. Backend Setup

```bash
cd backend
npm install
# Configure backend/.env with your ROBOFLOW_API_KEY
npm run dev
```

* **Backend Port:** `http://localhost:3001`
* **Test Endpoints Directly:** `npm run test:detection`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

* **Frontend Port:** `http://localhost:5173`
* **Build Production Bundle:** `npm run build`

### 3. Running Both (Root Convenience)

From the project root:

```bash
npm install
npm run dev
```

---

## 🌐 Communication Flow & Ports

```
[Browser / React Client] (Port 5173)
       │
       │ HTTP /api/detect (Proxied via Vite to Port 3001)
       ▼
[Express Backend Server] (Port 3001)
       │
       │ HTTPS POST (outline.roboflow.com with server-side ROBOFLOW_API_KEY)
       ▼
[Roboflow Hosted Inference API (YOLOv11-seg)]
```

---

## 📡 Backend API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Checks server status and tests connection to Roboflow model |
| `GET` | `/api/samples` | Returns list of curated sample road images for testing |
| `GET` | `/api/samples/:filename` | Serves sample image file |
| `POST` | `/api/detect` | Accepts uploaded image buffer or sample filename, runs YOLOv11 segmentation, and returns enriched pothole metrics |
