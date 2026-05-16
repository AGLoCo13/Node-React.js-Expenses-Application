const { GoogleGenerativeAI } = require('@google/generative-ai');

// Αρχικοποίηση με το κλειδί από το .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function extractReceiptData(imageBuffer, mimeType) {
    try {
        // Χρησιμοποιούμε το γρήγορο μοντέλο
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        // Το αυστηρό System Prompt
        const prompt = `You are an expert accounting AI for a building management system.
        Analyze this receipt and extract the details.
        
        RULES FOR THE "type" FIELD (STRICT CLASSIFICATION):
        - If the receipt is for gas, oil, or heating maintenance -> return "Heating"
        - If the receipt is for elevator repair, certification, or maintenance -> return "Elevator"
        - For ALL other expenses (electricity/power, water, cleaning services, building repairs, hardware) -> return "General"

        Return ONLY a raw JSON object (no markdown, no backticks). It must have these exact keys:
        {
            "amount": <Number, the total cost>,
            "month": <String, the month name e.g. "January", "February", etc.>,
            "year": <String, the year e.g. "2024">,
            "type": <String, ONLY "Heating", "Elevator", or "General">
        }`;

        // Προετοιμασία της εικόνας για το Gemini
        const dataPart = {
            inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType: mimeType
            }
        };

        // Στέλνουμε το αίτημα στο AI
        const result = await model.generateContent([prompt, dataPart]);
        const responseText = result.response.text();
        
        // Καθαρίζουμε το κείμενο σε περίπτωση που το AI βάλει ```json
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("AI Extraction Error:", error);
        throw new Error("Failed to extract data from receipt");
    }
}

module.exports = { extractReceiptData };