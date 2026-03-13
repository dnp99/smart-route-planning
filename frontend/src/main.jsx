import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./index.css";
import App from "./App.jsx";

document.documentElement.classList.remove("dark");
localStorage.removeItem("theme");
localStorage.removeItem("themePreferenceSource");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
