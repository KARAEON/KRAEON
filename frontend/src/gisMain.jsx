import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import WaterGisApp from "./water-gis/App.jsx";
import "./water-gis/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("GIS root element is missing");
root.classList.add("gis-full-root");
if (new URLSearchParams(window.location.search).get("embedded") === "1") {
  root.classList.add("embedded-gis-root");
}

createRoot(root).render(
  <StrictMode>
    <WaterGisApp />
  </StrictMode>,
);
