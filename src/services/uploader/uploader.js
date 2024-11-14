import multer from "multer";


const storage = multer.memoryStorage();
export const upload = multer({ storage: storage, limits: { fileSize: 30 * 1024 * 1024 } }); // Límite de 30 MB
