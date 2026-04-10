import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');

  const webDistPath = path.resolve(__dirname, '../../web/dist');
  const webIndexPath = path.join(webDistPath, 'index.html');

  if (fs.existsSync(webDistPath)) {
    app.useStaticAssets(webDistPath, {
      index: false,
    });

    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }

      if (req.path.startsWith('/api') || req.path.includes('.')) {
        return next();
      }

      if (!fs.existsSync(webIndexPath)) {
        return next();
      }

      return res.sendFile(webIndexPath);
    });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}
bootstrap();
