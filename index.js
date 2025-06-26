// Cambio forzado para que Render detecte el redeploy
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { OpenAI } = require('openai');
const Replicate = require('replicate');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

dotenv.config();
const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const upload = multer({ storage: multer.memoryStorage() });

// === Ruta: Generar imagen desde texto ===
app.post('/generate-image', async (req, res) => {
  const { prompt, formato = 'cuadrado', calidad = 'standard' } = req.body;

  let size;
  switch (formato) {
    case 'vertical': size = '1024x1792'; break;
    case 'horizontal': size = '1792x1024'; break;
    case 'cuadrado':
    default: size = '1024x1024'; break;
  }

  const calidadFormato = calidad === 'alta' ? 'hd' : 'standard';

  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality: calidadFormato,
      response_format: 'url'
    });

    const imageUrl = response.data[0].url;
    const imageRes = await fetch(imageUrl);
    const buffer = await imageRes.arrayBuffer();
    const fileName = `img_${Date.now()}.png`;
    const filePath = path.join(__dirname, 'imagenes', fileName);
    fs.writeFileSync(filePath, Buffer.from(buffer));

    const bancoPath = path.join(__dirname, 'banco.json');
    const banco = fs.existsSync(bancoPath) ? JSON.parse(fs.readFileSync(bancoPath)) : [];

    const imageEntry = {
      prompt,
      url: `http://localhost:${port}/imagenes/${fileName}`,
      formato,
      calidad
    };

    banco.unshift(imageEntry);
    fs.writeFileSync(bancoPath, JSON.stringify(banco, null, 2));

    res.json({ imageUrl: imageEntry.url });
  } catch (error) {
    console.error('Error al generar imagen:', error);
    res.status(500).json({ error: 'Error al generar imagen con OpenAI' });
  }
});

// === Ruta: Galería de imágenes generadas ===
app.get('/banco-imagenes', (req, res) => {
  const bancoPath = path.join(__dirname, 'banco.json');
  if (!fs.existsSync(bancoPath)) return res.json([]);
  const data = JSON.parse(fs.readFileSync(bancoPath));
  res.json(data);
});

// === Ruta: Mejorar nitidez usando Replicate ===
app.post('/mejorar-imagen', upload.single('imagen'), async (req, res) => {
  try {
    const imageBuffer = req.file.buffer;
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    const output = await replicate.run("sczhou/codeformer:8b6dbe1", {
      input: {
        image: base64Image,
        codeformer_fidelity: 1,
        face_upsample: true,
        upscale: 2
      }
    });

    res.json({ imageUrl: output });
  } catch (error) {
    console.error('Error en /mejorar-imagen:', error);
    res.status(500).json({ error: 'Error al procesar imagen con Replicate' });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
