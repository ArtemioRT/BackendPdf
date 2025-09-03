# ChatbotAlfaBackEnd

Backend de chatbot utilizando Azure OpenAI y Azure Search.

## Descripción
Este proyecto expone endpoints REST para procesar PDFs y documentos Word, generando embeddings con Azure OpenAI y realizando búsquedas con Azure Search.

## Requisitos
- Node.js >= 16
- Cuenta de Azure con recurso de OpenAI y Azure Search

## Instalación
1. Clonar el repositorio  
2. Copiar el archivo de ejemplo de variables de entorno:
   ```bash
   cp .env.example .env.devel
   ```
3. Ajustar los valores en `.env.devel` o `.env.prod`
4. Instalar dependencias:
   ```bash
   npm install
   ```

## Variables de entorno
```env
# Modo de ejecución: 'devel' o 'prod'
MODE=devel

# Puerto del servidor
PORT=3000

# Clave interna de la aplicación
KEY=tu_clave_secreta

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://<tu-recurso>.openai.azure.com/
AZURE_OPENAI_KEY=<tu-azure-openai-key>
AZURE_OPENAI_DEPLOYMENT=<nombre-deployment>
AZURE_OPENAI_MODEL=<nombre-modelo>        # ej. text-embedding-3-large
AZURE_OPENAI_API_VERSION=<api-version>    # ej. 2023-05-15

# Azure Search
AZURE_SEARCH_ENDPOINT=https://<tu-servicio>.search.windows.net
AZURE_SEARCH_KEY=<tu-azure-search-key>
```

## Ejecución
```bash
npm run start -- --mode devel
```

## Endpoints
- POST `/pdf`  
- POST `/word`  

## Pruebas
Configurar `.env.devel` con credenciales válidas y ejecutar peticiones a los endpoints.
