const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const Replicate = require('replicate');
const multer = require('multer');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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

// GENERAR IMAGEN DESDE PROMPT
app.post('/generate-image', async (req, res) => {
  const { prompt } = req.body;
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url'
    });
    const imageUrl = response.data[0].url;
    const fileName = `img_${Date.now()}.png`;
    const filePath = path.join(__dirname, 'imagenes', fileName);
    const imageRes = await fetch(imageUrl);
    const buffer = await imageRes.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));

    const bancoPath = path.join(__dirname, 'banco.json');
    const banco = fs.existsSync(bancoPath) ? JSON.parse(fs.readFileSync(bancoPath)) : [];
    banco.unshift({
      prompt,
      url: `https://simia-backend-v2.onrender.com/imagenes/${fileName}`
    });
    fs.writeFileSync(bancoPath, JSON.stringify(banco, null, 2));

    res.json({ imageUrl: `https://simia-backend-v2.onrender.com/imagenes/${fileName}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generando imagen.' });
  }
});

// MEJORAR IMAGEN
app.post('/mejorar-imagen', upload.single('imagen'), async (req, res) => {
  try {
    const imageUrl = `${req.protocol}://${req.get('host')}/${req.file.path.replace(/\\/g, '/')}`;
    const output = await replicate.run(
      "xinntao/real-esrgan:14d47c4af841d8b66f0a6b42d16a8ba87d285b78f5b5c7b40261ff9be60f6b5e",
      { input: { image: imageUrl, scale: 2, face_enhance: true } }
    );
    res.json({ imageUrl: output });
  } catch (err) {
    console.error("Error al mejorar imagen:", err);
    res.status(500).json({ error: "Error al mejorar imagen" });
  }
});

// RESTAURAR FOTO
app.post('/restaurar-foto', upload.single('imagen'), async (req, res) => {
  try {
    const imageUrl = `${req.protocol}://${req.get('host')}/${req.file.path.replace(/\\/g, '/')}`;
    const output = await replicate.run(
      "tencentarc/gfpgan:5fdc6f6f322f914e231619fa80a37b8db6542bfe1ef293bc639454e05680b133",
      { input: { img: imageUrl } }
    );
    res.json({ imageUrl: output });
  } catch (err) {
    console.error("Error al restaurar foto:", err);
    res.status(500).json({ error: "Error al restaurar foto" });
  }
});

// GALERIA
app.get('/banco-imagenes', (req, res) => {
  const bancoPath = path.join(__dirname, 'banco.json');
  if (!fs.existsSync(bancoPath)) return res.json([]);
  res.json(JSON.parse(fs.readFileSync(bancoPath)));
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
