import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// App creates the one and only router. Do not wrap it in another router.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
