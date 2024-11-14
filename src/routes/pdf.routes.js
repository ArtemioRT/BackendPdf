import { Router } from "express";
import multer from "multer";
import { PDFExtract } from "pdf.js-extract";
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { config } from "../controllers/config/config.js";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); // Límite de 10 MB

const pdfRoutes = Router();

const endpoint = "https://alfa-ai-search.search.windows.net";
const apiKey = `${config.AZURE_KEY}`;
const indexName = "alfa_bot";
const client = new SearchClient(endpoint, indexName, new AzureKeyCredential(apiKey));

const openaiApiKey = `${config.OPENAI_API_KEY}`;
const openaiEmbeddings = new OpenAIEmbeddings({ 
    apiKey: openaiApiKey, 
    modelName: "text-embedding-3-large", 
    dimensions: 1024,
    stripNewLines: true 
});

function generateSafeKey(fileName, index) {
    const baseFileName = fileName.replace(/\.[^/.]+$/, "");
    const safeFileName = baseFileName.replace(/[^a-zA-Z0-9_=-]/g, "-");
    return `${safeFileName}-${index}`;
}

function verifyEmbeddingDimension(embedding) {
    if (embedding.length !== 1024) {
        throw new Error(`Dimensión del embedding incorrecta: ${embedding.length}. Se esperaban 1024 dimensiones.`);
    }
    return embedding;
}

pdfRoutes.post('/sendPdf', upload.single('pdfFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Se requiere un archivo PDF" });
        }

        const pdfExtract = new PDFExtract();
        const pdfBuffer = req.file.buffer;

        const data = await pdfExtract.extractBuffer(pdfBuffer);
        const totalPages = data.pages.length;
        const chunkSize = 300;
        const chunkOverlap = 50;
        const maxPagesPerBatch = 20;

        const chunks = [];
        const documents = [];

        for (let i = 0; i < totalPages; i += maxPagesPerBatch) {
            const pageBatch = data.pages.slice(i, i + maxPagesPerBatch);
            const batchText = pageBatch.map(page => page.content.map(item => item.str).join(' ')).join(' ');

            for (let startIndex = 0; startIndex < batchText.length; startIndex += chunkSize - chunkOverlap) {
                chunks.push(batchText.slice(startIndex, startIndex + chunkSize));
            }

            for (const page of pageBatch) {
                documents.push({ pageNumber: page.pageNumber, text: page.content.map(item => item.str).join(' ') });
            }
        }

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const splitDocuments = await splitter.splitDocuments(
            chunks.map(chunk => ({ pageContent: chunk, metadata: { source: req.file.originalname } }))
        );

        const embeddings = await openaiEmbeddings.embedDocuments(splitDocuments.map(doc => doc.pageContent));

        const azureDocuments = splitDocuments.map((doc, index) => {
            const embedding = verifyEmbeddingDimension(embeddings[index]);
            return {
                '@search.action': 'upload',
                uniqueid: generateSafeKey(req.file.originalname, index),
                FileName: generateSafeKey(req.file.originalname, index),
                Chunk: doc.pageContent,
                Embedding: embedding,
                Folder: 'uploaded_files',
                archivoid: generateSafeKey(doc.metadata.source, index)
            };
        });

        const batch = await client.uploadDocuments(azureDocuments);

        console.log(`${batch.results.length} documentos cargados correctamente en Azure Cognitive Search.`);

        res.status(200).json({
            origin: config.PORT,
            chunks: JSON.stringify(embeddings),
            documents: JSON.stringify(documents),
            message: `${batch.results.length} documentos cargados correctamente en openAI embedings`
        });
    } catch (err) {
        console.error("Error al procesar el archivo PDF:", err);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

export { pdfRoutes };