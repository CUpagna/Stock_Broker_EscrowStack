# TradeView (Virtual Stock Trading Dashboard)

> A full-stack, real-time virtual stock trading simulator. TradeView provides users with $100,000 in virtual cash to buy and sell stocks, tracking their portfolio and transaction history alongside live-updating market prices.

## Features

* **Real-Time Market Data:** Live stock price updates streamed directly to the frontend via WebSockets.
* **Virtual Trading Engine:** Execute buy and sell orders using a starting virtual balance of $100,000.
* **Portfolio Management:** Track holdings, calculate average buy prices, and monitor total net worth.
* **Transaction History:** A detailed, chronological log of all trades executed.
* **User Authentication:** Complete login, registration, and password reset flows (using secure SHA-256 hashing).
* **Responsive Dashboard:** A clean, grid-based UI with active subscription toggles, dynamic price color-coding (green/red), and quick-trade modals.

---

## Tech Stack

| Environment | Technologies | Purpose |
| :--- | :--- | :--- |
| **Backend** | Python, FastAPI | REST API, WebSocket management, Trading logic |
| **Database** | SQLite, Python `sqlite3` | Persistent user data, portfolios, and transactions |
| **Frontend** | React, HTML5 | Component-based UI rendering, state management |
| **Styling** | Vanilla CSS | Custom, responsive design with dynamic themes |

---

## Getting Started

Follow these steps to run the application locally.

### 1. Backend Setup (FastAPI)

The backend handles API requests, database interactions, and the simulated WebSocket price ticker.

1.  Navigate to the backend directory (or wherever `main.py` is located).
2.  Install the required Python dependencies:
``bash
    pip install fastapi uvicorn websockets pydantic
    ```
3.  Start the FastAPI server:
``bash
    uvicorn main:app --reload
    ```
    *The server will start on `http://localhost:8000`. The SQLite database (`tradeview.db`) will be automatically initialized on startup.*

### 2. Frontend Setup (React)

The frontend is a React application that connects to the FastAPI backend.

1.  Navigate to your React project directory.
2.  Install standard dependencies (if not already installed):
``bash
    npm install
    ``
3.  Start the development server:
``bash
    npm start
    ``
    *The frontend will start on `http://localhost:3000`.*

---

## Project Structure

### Backend
* **`main.py`**: The core FastAPI application. Contains user routing (login/register), the trading engine `/trade`, SQLite database initializations, and the WebSocket connection manager for live simulated price updates.

### Frontend Components
* **`App.js` & `index.js`**: React entry points handling the primary authentication state routing.
* **`Dashboard.js`**: The main application view. Manages WebSocket connections, portfolio state, dynamic UI updates, and trading modals.
* **`LoginPage.js`**: Handles user authentication flows, including registering new accounts and generating demo password-reset tokens.

### Stylesheets (CSS)
* **`index.css`**: Global variables (colors, fonts), resets, and base typography.
* **`Dashboard.css`**: Layout grids, navigation bars, stat cards, and transaction tables.
* **`LoginPage.css`**: Styling for the authentication cards, animated background overlays, and form inputs.
* **`StockCard.css`**: Component-specific styles for individual stock items, including pulse animations and dynamic up/down indicators.

---

## Usage Notes & Simulation Details

* **Market Simulator:** Because this is a development project, `main.py` includes an asynchronous background task that randomly fluctuates base stock prices by ±0.5% every second to simulate an active market.
* **Demo Accounts:** You can create your own account from the login page, or use the UI hints to instantly populate test credentials.
* **Security Note:** Passwords are hashed using standard `hashlib.sha256` for demonstration purposes. Reset tokens are generated safely via the `secrets` module but are returned directly in the UI for ease of testing.
