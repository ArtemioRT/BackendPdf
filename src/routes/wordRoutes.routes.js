import mammoth from "mammoth";
import { Router } from "express";
import { uploadToDisk, upload } from "../services/uploader/uploader.js";
import { generateSafeKey } from "../services/utils/generateSafeKey.js";
import { verifyEmbeddingDimension } from "../services/utils/verifyEmmbedingDimension.js"
import { client } from "../services/azureCredentials/azure.credentials.js";
import WordExtractor from 'word-extractor'
import { openaiEmbeddings } from "../services/openIA/openAI.config.js";
import { config } from "../controllers/config/config.js";
import { convertDocToDocx } from "../services/utils/convertDocDocx.js";
import { logger } from "../services/log/logger.js";

const wordRoutes = Router();
const processedFiles = new Set();
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
            const extractor = new WordExtractor();
            try {
                const doc = await extractor.extract(req.file.buffer); // Espera a que se extraiga el texto
                extractedText = doc.getBody(); // Obtiene el cuerpo del texto extraído
            } catch (err) {
                logger.error("Error extrayendo texto:", err);
                return res.status(500).json({ error: "Error extrayendo texto del archivo Word" });
            }
            // extractedText = value;
        } else {
            return res.status(400).json({ error: "Tipo de archivo no soportado" });
        }

        if (extractedText === '') {
            return res.status(400).json({ error: "No se pudo extraer texto del archivo Word" });
        }
        const chunkSize = 9000;
        const chunkOverlap = 700;
        const chunks = [];

        // Dividir el texto extraído en trozos (chunks) con solapamiento
        for (let startIndex = 0; startIndex < extractedText.length; startIndex += chunkSize - chunkOverlap) {
            chunks.push(extractedText.slice(startIndex, startIndex + chunkSize));
        }

        // Crear un documento para cada chunk, con el número de chunk como "pageNumber"
        const documents = chunks.map((chunk, index) => ({
            pageNumber: index + 1,
            text: chunk
        }));
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

        logger.info(`${batch.results.length} documentos cargados correctamente en Azure Cognitive Search.`);

        processedFiles.add(fileName);

        res.status(200).json({
            origin: config.PORT,
            chunks: JSON.stringify(embeddings),
            documents: JSON.stringify(documents),
            message: `${batch.results.length} documentos cargados correctamente en openAI embeddings`
        });
    } catch (err) {
        logger.error("Error al procesar el archivo Word:", err);
        res.status(500).json({
            error: 'Error interno del servidor',
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

export { wordRoutes };