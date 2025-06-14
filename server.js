import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { fetchUserProfile } from "./fetch.js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import helmet from "helmet";
import compression from "compression";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(helmet()); // Adds security headers
app.use(compression()); // Gzip compression
app.use(express.json());
app.use(express.static("public"));

// Rate limiting
app.set("trust proxy", 1);
const limiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  limit: 20, // Max 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Serve index.html
app.get("/", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));
// LeetCode data route
app.get("/:username", fetchUserProfile);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// Dynamic port for deployment
const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
