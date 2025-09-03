import * as url from "url";
import dotenv from "dotenv";
import { Command } from "commander";

// Configuración de línea de comandos
const commandLine = new Command();
commandLine
  .option("--mode <SECRET>")
  .option("--port <PORT>")
  .option("--setup <APP_NAME>");
commandLine.parse();
const clOptions = commandLine.opts();

// Carga de variables de entorno
dotenv.config();
dotenv.config({ path: clOptions.mode === "prod" ? ".env.prod" : ".env.devel" });

export const config = {
  KEY: process.env.KEY,
  PORT: process.env.PORT,
  DIRNAME: url.fileURLToPath(new URL("../../", import.meta.url)),
  DIRNAME_LOG: url.fileURLToPath(
    new URL("../../services/log/register", import.meta.url)
  ),
  get UPLOAD_DIR() {
    return `${this.DIRNAME}/public/pdf`;
  },
  MODE: process.env.MODE,

  // Azure OpenAI
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY,
  AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
  AZURE_OPENAI_MODEL: process.env.AZURE_OPENAI_MODEL,
  AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_API_INSTANCE_NAME: process.env.AZURE_OPENAI_API_INSTANCE_NAME,

  // Azure Search
  AZURE_SEARCH_ENDPOINT: process.env.AZURE_SEARCH_ENDPOINT,
  AZURE_SEARCH_KEY: process.env.AZURE_SEARCH_KEY,
  AZURE_SEARCH_INDEX_NAME: process.env.AZURE_SEARCH_INDEX_NAME,
};
