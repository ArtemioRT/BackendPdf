import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
import { config } from "../../controllers/config/config.js";

/**
 * Cliente de Azure OpenAI
 */
export const openAIClient = new OpenAIClient(
  config.AZURE_OPENAI_ENDPOINT,
  new AzureKeyCredential(config.AZURE_OPENAI_KEY)
);

/**
 * Obtiene embeddings para un arreglo de textos usando Azure OpenAI.
 * @param {string[]} inputs
 * @returns {Promise<number[][]>}
 */
export async function getEmbeddings(inputs) {
  const embeddings = [];
  for (const text of inputs) {
    const result = await openAIClient.getEmbeddings(
      config.AZURE_OPENAI_DEPLOYMENT,
      text,
      { apiVersion: config.AZURE_OPENAI_API_VERSION }
    );
    // El primer embedding contiene el vector
    embeddings.push(result.embeddings[0].embedding);
  }
  return embeddings;
}
