// ... (importaciones y configuración igual)

app.post('/generate-image', async (req, res) => {
  const { prompt, formato = 'cuadrado', calidad = 'standard' } = req.body;

  let size;
  switch (formato) {
    case 'vertical':
      size = '1024x1792';
      break;
    case 'horizontal':
      size = '1792x1024';
      break;
    default:
      size = '1024x1024';
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

    // CORREGIDO: usar host dinámico
    const host = req.get('host');
    const protocol = req.protocol;
    const finalUrl = `${protocol}://${host}/imagenes/${fileName}`;

    const imageEntry = {
      prompt,
      url: finalUrl,
      formato,
      calidad
    };

    banco.unshift(imageEntry);
    fs.writeFileSync(bancoPath, JSON.stringify(banco, null, 2));

    res.json({ imageUrl: finalUrl });
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

// NUEVO: Para que Render muestre algo en la raíz /
app.get('/', (req, res) => {
  res.send('✅ Simia backend está activo');
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
