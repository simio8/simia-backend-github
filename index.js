// Cambio forzado para que Render detecte el redeploy
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

dotenv.config();
const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/generate-image', async (req, res) => {
  const { prompt, formato = 'cuadrado', calidad = 'standard' } = req.body;

  // Tamaño según formato (ajustable si se desea más adelante)
  let size;
  switch (formato) {
    case 'vertical':
      size = '1024x1792';
      break;
    case 'horizontal':
      size = '1792x1024';
      break;
    case 'cuadrado':
    default:
      size = '1024x1024';
      break;
  }

  // Calidad de imagen
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

    // Descargar y guardar la imagen localmente
    const imageRes = await fetch(imageUrl);
    const buffer = await imageRes.arrayBuffer();
    const fileName = `img_${Date.now()}.png`;
    const filePath = path.join(__dirname, 'imagenes', fileName);
    fs.writeFileSync(filePath, Buffer.from(buffer));

    // Registrar en banco de imágenes
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

app.get('/banco-imagenes', (req, res) => {
  const bancoPath = path.join(__dirname, 'banco.json');
  if (!fs.existsSync(bancoPath)) return res.json([]);
  const data = JSON.parse(fs.readFileSync(bancoPath));
  res.json(data);
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
