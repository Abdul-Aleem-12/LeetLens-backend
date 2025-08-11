import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import helmet from "helmet";
import compression from "compression";
import { GenerateAiSummary } from './AiSummary.js';
import { leetDataMiddleware } from "./DataMiddleware.js";
import { supabase } from './supabaseClient.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(helmet()); 
app.use(compression()); 
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
app.use(
  express.static("public", {
    setHeaders: (res, path) => {
      if (path.endsWith(".js") || path.endsWith(".css") || path.endsWith(".svg")) {
        res.setHeader("Cache-Control", "public, max-age=3600"); // 1 hour
      } else {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  })
);
app.use(limiter);

// Serve index.html

app.get('/', (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// AI Summary endpoint
app.get('/summary/:username(*)', leetDataMiddleware, async (req, res) => {
  try {
    const aiSummary = await GenerateAiSummary(req);
    res.json(aiSummary);
  } catch (error) {
    console.error('AI Summary failed:', error);
    res.status(500).json({ 
      error: "AI analysis failed",
      fallback: `Basic stats: ${req.formattedData.totalSolved} problems solved` 
    });
  }
});

// LeetCode data route
app.get('/:username(*)', leetDataMiddleware, (req, res) => {
  res.json(req.formattedData);
});

// general route 
app.get('*', (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post('/api/log', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  // Get IST timestamp
  const offsetMinutes = 330; // IST offset from UTC
  const nowIST = new Date();
  nowIST.setMinutes(nowIST.getMinutes() + offsetMinutes);
  const istString = nowIST.toISOString().slice(0, 19).replace('T', ' '); 

  const { data, error } = await supabase
    .from('user_logs') // Change to your actual table name
    .insert([{ user_id, timestamp: istString }])
    .select('id') // return only the id
    .single();

  if (error) {
    console.error('Error inserting log:', error);
    return res.status(500).json({ error: 'Failed to insert log' });
  }

  res.json({ message: 'Log created successfully', log: data });
});

// update log
app.post('/api/log/update', async (req, res) => {
  console.log("Update log request body:", req.body); 
  const { id, Real_Name, Total_Solved } = req.body;

  if (!id || !Real_Name || Total_Solved === undefined) {
    return res.status(400).json({ error: 'Missing values' });
  }

  const { data, error } = await supabase
    .from('user_logs')
    .update({
      Real_name: Real_Name,       
      Total_solved: Total_Solved  
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating log:', error);
    return res.status(500).json({ error: 'Failed to update log' });
  }

  res.json({ message: 'Updated successfully', log: data });
});

// scroll status update
app.post("/api/log/scroll", async (req, res) => {
  const { id, fully_scrolled } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Missing log ID" });
  }

  const { data, error } = await supabase
    .from("user_logs")
    .update({ fully_scrolled })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating scroll status:", error);
    return res.status(500).json({ error: "Failed to update scroll status" });
  }

  res.json({ message: "Scroll status updated", log: data });
});


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
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}


export default app; // Export for testing purposes