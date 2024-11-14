import fs from "fs";
import path from "path";

export function convertDocToDocx(docBuffer) {
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