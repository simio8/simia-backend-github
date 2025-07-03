const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const Replicate = require('replicate');
const multer = require('multer');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

dotenv.config();
const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const upload = multer({ dest: 'uploads/' });

// === Generar imagen desde prompt con DALL·E ===
app.post('/generate-image', async (req, res) => {
  const { prompt, formato = 'cuadrado', calidad = 'standard' } = req.body;

  let size;
  switch (formato) {
    case 'vertical': size = '1024x1792'; break;
    case 'horizontal': size = '1792x1024'; break;
    default: size = '1024x1024';
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
      url: `https://simia-backend-v2.onrender.com/imagenes/${fileName}`,
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

// === Mejorar nitidez con Real-ESRGAN ===
app.post('/mejorar-imagen', upload.single('imagen'), async (req, res) => {
  try {
    const imageUrl = `${req.protocol}://${req.get('host')}/${req.file.path.replace(/\\/g, '/')}`;
    const output = await replicate.run(
      "xinntao/real-esrgan:latest",
      { input: { image: imageUrl, scale: 2, face_enhance: true } }
    );
    res.json({ imageUrl: output });
  } catch (error) {
    console.error("Error al mejorar imagen:", error);
    res.status(500).json({ error: "No se pudo mejorar la imagen." });
  }
});

// === Restaurar foto antigua con GFPGAN ===
app.post('/restaurar-foto', upload.single('imagen'), async (req, res) => {
  try {
    const imageUrl = `${req.protocol}://${req.get('host')}/${req.file.path.replace(/\\/g, '/')}`;
    const output = await replicate.run(
      "tencentarc/gfpgan:latest",
      { input: { img: imageUrl, version: "v1.4" } }
    );
    res.json({ imageUrl: output });
  } catch (error) {
    console.error("Error al restaurar foto:", error);
    res.status(500).json({ error: "No se pudo restaurar la foto." });
  }
});

// === Galería ===
app.get('/banco-imagenes', (req, res) => {
  const bancoPath = path.join(__dirname, 'banco.json');
  if (!fs.existsSync(bancoPath)) return res.json([]);
  const data = JSON.parse(fs.readFileSync(bancoPath));
  res.json(data);
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
