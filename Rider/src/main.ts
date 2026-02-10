import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { register } from 'swiper/element/bundle';

if (environment.production) {
  enableProdMode();
}

// Register Swiper Web Components globally for Ionic 7 slides replacement
register();

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
