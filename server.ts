import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON payloads with generous limit for camera photos
  app.use(express.json({ limit: '25mb' }));

  // API Route: Scan address from camera photo or image using Gemini Vision
  app.post('/api/scan-address', async (req: Request, res: Response) => {
    try {
      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'Missing image data' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server',
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Normalize base64 image data
      let base64Data = image;
      let detectedMime = mimeType || 'image/jpeg';

      if (image.startsWith('data:')) {
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          detectedMime = matches[1];
          base64Data = matches[2];
        }
      }

      const prompt = `You are a medical courier dispatch assistant. Carefully inspect this photo taken with a phone camera.
The photo contains a prescription bottle label, medication delivery bag, shipping slip, invoice, patient delivery sheet, or handwritten address label.

Your task is to extract the DESTINATION DELIVERY ADDRESS (where the driver must drop off the medication).
CRITICAL RULES:
1. If both a pharmacy / sender address (e.g., "Austin Central Pharmacy", "St. David's Medical Center Hub") AND a recipient / patient delivery address are present, YOU MUST EXTRACT THE RECIPIENT'S DELIVERY ADDRESS, NOT THE PHARMACY ADDRESS.
2. If there is only one address, extract it.
3. Clean up the address into standard delivery format: Street Address, City, State, 5-digit ZIP.
4. Check if the delivery is marked as STAT, URGENT, PRIORITY, EMERGENCY, REFRIGERATED, or ASAP.
5. Extract patient name, Rx number, medication name, and any delivery notes (e.g. gate codes, apartment numbers, building names, delivery instructions) if visible.

Output structured JSON matching the schema.`;

      const candidateModels = [
        'gemini-3.8-flash',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-1.5-flash',
      ];

      let lastError: any = null;
      let parsedData: any = null;

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: detectedMime,
                    data: base64Data,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  address: {
                    type: Type.STRING,
                    description: 'Full delivery street address with city, state, and zip code',
                  },
                  street: {
                    type: Type.STRING,
                    description: 'Street address including apartment or suite number',
                  },
                  city: {
                    type: Type.STRING,
                    description: 'City name',
                  },
                  state: {
                    type: Type.STRING,
                    description: '2-letter state abbreviation',
                  },
                  zip: {
                    type: Type.STRING,
                    description: '5-digit postal code',
                  },
                  patientName: {
                    type: Type.STRING,
                    description: 'Patient or recipient name if visible',
                  },
                  rxNumber: {
                    type: Type.STRING,
                    description: 'Prescription number if visible',
                  },
                  medicationName: {
                    type: Type.STRING,
                    description: 'Medication name if visible',
                  },
                  isStat: {
                    type: Type.BOOLEAN,
                    description: 'True if marked STAT, Urgent, Priority, or Emergency',
                  },
                  notes: {
                    type: Type.STRING,
                    description: 'Special delivery instructions or gate code',
                  },
                  confidence: {
                    type: Type.STRING,
                    description: 'high, medium, or low',
                  },
                  rawExtractedText: {
                    type: Type.STRING,
                    description: 'Summary of text read from the label',
                  },
                },
                required: ['address'],
              },
            },
          });

          const text = response.text?.trim() || '{}';
          parsedData = JSON.parse(text);
          if (parsedData && parsedData.address) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Model ${modelName} encountered note:`, err?.message || err);
          // Try next model in candidate list
        }
      }

      if (!parsedData || !parsedData.address) {
        throw lastError || new Error('Could not identify a delivery address on this label.');
      }

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (err: any) {
      console.error('Error scanning address with Gemini:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to scan address from photo',
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
