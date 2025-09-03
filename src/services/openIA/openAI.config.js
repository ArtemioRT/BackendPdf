import OpenAI from "openai";
import { config } from "../../controllers/config/config.js";

/**
 * Cliente de Azure OpenAI usando el SDK oficial de OpenAI con soporte Azure
 */
export const openAIClient = new OpenAI({
  azure: {
    apiKey: config.AZURE_OPENAI_KEY,
    endpoint: config.AZURE_OPENAI_ENDPOINT,
    deploymentName: config.AZURE_OPENAI_DEPLOYMENT,
    apiVersion: config.AZURE_OPENAI_API_VERSION
  }
});

/**
 * Obtiene embeddings para un arreglo de textos usando Azure OpenAI.
 * @param {string[]} inputs
 * @returns {Promise<number[][]>}
 */
export async function getEmbeddings(inputs) {
  const embeddings = [];
  for (const text of inputs) {
    const response = await openAIClient.embeddings.create({
      model: config.AZURE_OPENAI_DEPLOYMENT,
      input: text
    });
    embeddings.push(response.data[0].embedding);
  }
  return embeddings;
}
