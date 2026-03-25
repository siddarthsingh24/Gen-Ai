import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve UI folder (one level up from backend)
app.use(express.static(path.join(__dirname, '../Ui')));

// ✅ Serve index.html properly
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../Ui', 'index.html'));
});

// Gemini AI setup
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || ""
});

// API route
app.post('/api/chat', async (req, res) => {
    try {
        console.log("Incoming request:", req.body);

        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: message,
            config: {
                systemInstruction:
                    "You are a DSA Instructor. Only answer DSA-related questions with clear explanations. If the question is off-topic, rudely decline."
            }
        });

        res.json({ response: response.text });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
