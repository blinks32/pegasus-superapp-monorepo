import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NgOtpInputModule } from 'ng-otp-input';

import { OtpComponent } from './otp/otp.component';
import { CountrySearchModalComponent } from './country-search-modal/country-search-modal.component';
import { EnrouteChatComponent } from './enroute-chat/enroute-chat.component';
import { TripSummaryComponent } from './trip-summary/trip-summary.component';

@NgModule({
    imports: [
        CommonModule,
        IonicModule,
        FormsModule,
        ReactiveFormsModule,
        TranslateModule,
        NgOtpInputModule,
        OtpComponent,
        CountrySearchModalComponent,
        EnrouteChatComponent,
        TripSummaryComponent
    ],
    exports: [
        OtpComponent,
        CountrySearchModalComponent,
        EnrouteChatComponent,
        TripSummaryComponent
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ComponentsModule { }
