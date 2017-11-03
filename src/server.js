import express from 'express';
import nestRoutes from './routes/nest';
import alexaRoutes from './routes/alexa';
import bodyParser from 'body-parser';
import config from './config';

const app = express();

app.use(bodyParser.json());
app.use('/nest', nestRoutes);
app.use('/alexa', alexaRoutes);
app.get('/', (req, res) => {
  res.end('Hello world');
});

app.listen(config.port, () => {
  console.log('Listening on 3000');
});