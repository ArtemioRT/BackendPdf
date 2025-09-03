import OpenAI from "openai";
import { config } from "../../controllers/config/config.js";

/**
 * Cliente de Azure OpenAI usando el SDK oficial de OpenAI con soporte Azure
 */
export const openAIClient = new OpenAI({
  apiKey: config.AZURE_OPENAI_KEY,
  baseURL: `${config.AZURE_OPENAI_ENDPOINT}/openai/deployments/${config.AZURE_OPENAI_DEPLOYMENT}`,
  defaultQuery: { 'api-version': config.AZURE_OPENAI_API_VERSION },
  defaultHeaders: {
    'api-key': config.AZURE_OPENAI_KEY,
  },
});

/**
 * Obtiene embeddings para un arreglo de textos usando Azure OpenAI.
 * @param {string[]} inputs
 * @returns {Promise<number[][]>}
 */
export async function getEmbeddings(inputs) {
  try {
    const embeddings = [];
    
    for (const text of inputs) {
      const response = await openAIClient.embeddings.create({
        model: config.AZURE_OPENAI_DEPLOYMENT, // Este debe ser el nombre del modelo de embedding
        input: text
      });
      
      embeddings.push(response.data[0].embedding);
    }
    
    return embeddings;
  } catch (error) {
    console.error('Error al obtener embeddings:', error);
    throw error;
  }
}

/**
 * Versión optimizada que procesa todos los inputs en una sola llamada
 * @param {string[]} inputs
 * @returns {Promise<number[][]>}
 */
export async function getEmbeddingsBatch(inputs) {
  try {
    const response = await openAIClient.embeddings.create({
      model: config.AZURE_OPENAI_DEPLOYMENT,
      input: inputs // Envía todo el array de una vez
    });
    
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Error al obtener embeddings en lote:', error);
    throw error;
  }
}