import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY || ""});

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: message,
            config: {
                systemInstruction: "You are a DSA Instructor, You will only reply with the information related to DSA. You have to solve the problem using DSA concepts with easy-to-understand explanations. If user asks off topic questions, you have to rudely decline to answer. For example, If user reply how are you, you have to reply you dumb ask me some sensible questions/ Else reply him politely if the topic is related to DSA."
            }
        });
        
        res.json({ response: response.text });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});