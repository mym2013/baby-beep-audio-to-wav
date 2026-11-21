const express = require("express");
const cors = require("cors");
const multer = require("multer");

const { execFile } = require("child_process");
const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3040;


// --------------------------------------------------
// Rutas del proyecto
// --------------------------------------------------

const ROOT_DIR = path.join(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const INPUT_DIR = path.join(ROOT_DIR, "input");
const OUTPUT_DIR = path.join(ROOT_DIR, "output");


// Asegurar que las carpetas existan

fs.mkdirSync(INPUT_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });


// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(cors());
app.use(express.static(FRONTEND_DIR));


// --------------------------------------------------
// Multer
// --------------------------------------------------
const allowedExtensions = new Set([
  ".mp3", ".ogg", ".opus", ".wav", ".flac", ".m4a", ".aac", ".aiff", ".wma"
]);

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, INPUT_DIR);
  },

  filename: (req, file, cb) => {

    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, randomUUID() + extension);
  }

});


const upload = multer({

  storage,

  limits: {
    fileSize: 100 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.has(extension)) {
    return cb(new Error("Formato admitido: MP3, OGG, OPUS, WAV, FLAC, M4A, AAC, AIFF o WMA."));
  }

  cb(null, true);
}

});


// --------------------------------------------------
// Estado del servidor
// --------------------------------------------------

app.get("/health", (req, res) => {

  res.json({
    status: "ok",
    service: "Baby-Beep · Conversor a WAV"
  });

});


// --------------------------------------------------
// Conversión de audio a WAV para YAMNet
// --------------------------------------------------

app.post("/convert", upload.single("audio"), (req, res) => {

  if (!req.file) {

    return res.status(400).json({
      error: "No se recibió ningún archivo."
    });

  }

  const inputPath = req.file.path;

  const originalName =
    path.parse(req.file.originalname).name;

  const safeName = originalName
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim() || "audio";

  const outputName = `${safeName}.wav`;

  const outputPath = path.join(
    OUTPUT_DIR,
    `${req.file.filename}.wav`
  );

  const ffmpegArgs = [
    "-nostdin",
    "-loglevel", "error",
    "-protocol_whitelist", "file",
    "-format_whitelist", "mp3,ogg,wav,flac,mov,m4a,mp4,3gp,3g2,mj2,aac,aiff,asf",
    "-i", inputPath,
    "-map", "0:a:0",
    "-ac", "1",
    "-ar", "16000",
    "-c:a", "pcm_s16le",
    "-f", "wav",
    outputPath
  ];

  execFile("ffmpeg", ffmpegArgs, (error) => {

    fs.unlink(inputPath, () => {});

    if (error) {

      console.error("Error FFmpeg:", error.message);

      fs.unlink(outputPath, () => {});

      return res.status(500).json({
        error: "No fue posible convertir el archivo."
      });

    }

    res.type("audio/wav");

    res.download(
      outputPath,
      outputName,
      (downloadError) => {

        fs.unlink(outputPath, () => {});

        if (downloadError) {

          console.error(
            "Error enviando archivo:",
            downloadError.message
          );

        }

      }
    );

  });

});


// --------------------------------------------------
// Manejo de errores de subida
// --------------------------------------------------

app.use((error, req, res, next) => {

  console.error(error.message);

  res.status(400).json({
    error: error.message
  });

});


// --------------------------------------------------
// Inicio
// --------------------------------------------------

app.listen(PORT, () => {

  console.log(
    `Conversor a WAV activo en http://localhost:${PORT}`
  );

});
