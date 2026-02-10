import { NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    TranslateModule.forChild()
  ],
  exports: [
    TranslateModule
  ]
})
export class SharedTranslationsModule { } 