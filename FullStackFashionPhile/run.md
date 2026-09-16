# FashionPhile Scraper Fullstack Setup & Run Guide

To run this application, you will need to start both the Python backend API and the React frontend. It's best to open two separate terminal windows.

---

## 1. Start the Backend (API & Scraper)

The backend uses FastAPI to run the scraping logic and serve the downloaded files.

1. Open a new terminal.
2. Navigate to the `FashionPhile_scraper` directory:
   ```bash
   cd FashionPhile_scraper
   ```
3. Start the FastAPI server:
   ```bash
   python api.py
   ```
   *Note: Ensure your Python environment has the required packages installed (`pip install fastapi uvicorn pydantic requests beautifulsoup4` etc.).*

The backend will now be running at **http://localhost:8080**.

---

## 2. Start the Frontend (React UI)

The frontend uses React, Vite, and Tailwind CSS to provide a clean user interface.

1. Open a second, separate terminal.
2. Navigate to the `Frontend` directory:
   ```bash
   cd Frontend
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

The frontend will now be accessible in your web browser at **http://localhost:5176**.

---

## Usage

1. Go to **http://localhost:5176** in your browser.
2. Enter a FashionPhile collection URL (e.g., `https://www.fashionphile.com/collections/all-bags?refinementList%5Bvendor%5D%5B0%5D=MCM&sortBy=shopify_products_published_at_desc`).
3. Set the max pages you want to scrape (or `0` for all).
4. Click **Start Scraper**. 
5. Wait for the extraction to complete, then click the buttons to download your data as `.csv` or `.json`.
