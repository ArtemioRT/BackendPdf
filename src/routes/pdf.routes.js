import { Router } from "express";
import multer from "multer";
import { PDFExtract } from "pdf.js-extract";
import { SearchClient, AzureKeyCredential } from "@azure/search-documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { config } from "../controllers/config/config.js";
import mammoth from "mammoth";
import fs from "fs";
import path from "path";


const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 30 * 1024 * 1024 } }); // Límite de 30 MB

const pdfRoutes = Router();
const wordRoutes= Router();

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

const processedFiles = new Set(); // Registro de archivos procesados

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

        const fileName = req.file.originalname;
        if (processedFiles.has(fileName)) {
            return res.status(400).json({ error: "Este archivo ya ha sido procesado" });
        }

        const pdfExtract = new PDFExtract();
        const pdfBuffer = req.file.buffer;
        const data = await pdfExtract.extractBuffer(pdfBuffer);

        const totalPages = data.pages.length;
        const chunkSize = 2000;
        const chunkOverlap = 150;
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

        const embeddings = await openaiEmbeddings.embedDocuments(chunks);

        const azureDocuments = chunks.map((chunk, index) => {
            const embedding = verifyEmbeddingDimension(embeddings[index]);
            return {
                '@search.action': 'upload',
                uniqueid: generateSafeKey(fileName, index),
                FileName: generateSafeKey(fileName, index),
                Chunk: chunk,
                Embedding: embedding,
                Folder: 'uploaded_files',
                archivoid: generateSafeKey(fileName, index)
            };
        });

        const batch = await client.uploadDocuments(azureDocuments);

        console.log(`${batch.results.length} documentos cargados correctamente en Azure Cognitive Search.`);

        processedFiles.add(fileName);

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

// Función para convertir .doc a .docx
function convertDocToDocx(docBuffer) {
    return new Promise((resolve, reject) => {
        const tempDocxPath = path.join(__dirname, 'temp', 'converted.docx');
        const docPath = path.join(__dirname, 'temp', 'temp.doc');
        fs.writeFileSync(docPath, docBuffer);

        exec(`unoconv -f docx ${docPath} -o ${tempDocxPath}`, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`Error al convertir .doc a .docx: ${stderr}`));
            } else {
                const docxBuffer = fs.readFileSync(tempDocxPath);
                fs.unlinkSync(docPath); // Limpiar archivo temporal .doc
                fs.unlinkSync(tempDocxPath); // Limpiar archivo temporal .docx
                resolve(docxBuffer);
            }
        });
    });
}

wordRoutes.post('/sendWord', upload.single('wordFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Se requiere un archivo Word" });
        }

        const fileName = req.file.originalname;
        if (processedFiles.has(fileName)) {
            return res.status(400).json({ error: "Este archivo ya ha sido procesado" });
        }

        let extractedText = '';
        if (fileName.endsWith('.docx')) {
            // Si el archivo es .docx, extraemos el texto directamente
            const { value } = await mammoth.extractRawText({ buffer: req.file.buffer });
            extractedText = value;
        } else if (fileName.endsWith('.doc')) {
            // Si el archivo es .doc, lo convertimos primero a .docx
            const docxBuffer = await convertDocToDocx(req.file.buffer);
            const { value } = await mammoth.extractRawText({ buffer: docxBuffer });
            extractedText = value;
        } else {
            return res.status(400).json({ error: "Tipo de archivo no soportado" });
        }

        if (!extractedText) {
            return res.status(400).json({ error: "No se pudo extraer texto del archivo Word" });
        }

        const chunkSize = 2000;
        const chunkOverlap = 150;

        const chunks = [];
        const documents = [];

        // Dividir el texto extraído en trozos más pequeños
        for (let startIndex = 0; startIndex < extractedText.length; startIndex += chunkSize - chunkOverlap) {
            chunks.push(extractedText.slice(startIndex, startIndex + chunkSize));
        }

        // Crear documentos con el texto extraído
        for (let i = 0; i < chunks.length; i++) {
            documents.push({ pageNumber: i + 1, text: chunks[i] });
        }

        const embeddings = await openaiEmbeddings.embedDocuments(chunks);

        const azureDocuments = chunks.map((chunk, index) => {
            const embedding = verifyEmbeddingDimension(embeddings[index]);
            return {
                '@search.action': 'upload',
                uniqueid: generateSafeKey(fileName, index),
                FileName: generateSafeKey(fileName, index),
                Chunk: chunk,
                Embedding: embedding,
                Folder: 'uploaded_files',
                archivoid: generateSafeKey(fileName, index)
            };
        });

        const batch = await client.uploadDocuments(azureDocuments);

        console.log(`${batch.results.length} documentos cargados correctamente en Azure Cognitive Search.`);

        processedFiles.add(fileName);

        res.status(200).json({
            origin: config.PORT,
            chunks: JSON.stringify(embeddings),
            documents: JSON.stringify(documents),
            message: `${batch.results.length} documentos cargados correctamente en openAI embeddings`
        });
    } catch (err) {
        console.error("Error al procesar el archivo Word:", err);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

export { wordRoutes };
export { pdfRoutes };
