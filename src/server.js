import express from 'express';
import nestRoutes from './routes/nest';

const app = express();

app.use('/nest', nestRoutes);
app.listen(3000, () => {
  console.log('Listening on 3000');
});