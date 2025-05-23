import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { fetchUserProfile} from "./fetch.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();  

// Enable CORS for all origins
app.use(
    cors({
        origin: "*",
    })
);

// Enable rate limiting to prevent abuse
app.set("trust proxy", 1);
const limiter = rateLimit({
    windowMs: 2 * 60 * 1000, // 15 minutes
    limit: 15, // Limit of 15 requests per windowMs
    standardHeaders: "draft-7",
    legacyHeaders: false,
});

app.use(limiter);

// Enable JSON parsing
app.use(express.json());

// Serve static files from the 'public' folder
app.use(express.static("public"));

// Handle the root route and serve HTML and CSS files
app.get("/", (req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Fetch user profile for a specific username
app.get("/:username", fetchUserProfile);

// Start the server on port 8000
const PORT = 8000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
