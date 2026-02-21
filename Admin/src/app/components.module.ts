import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { NgOtpInputModule } from 'ng-otp-input';

import { OtpComponent } from './otp/otp.component';
import { CountrySearchModalComponent } from './country-search-modal/country-search-modal.component';
import { CartypeComponent } from './cartype/cartype.component';
import { DocumentsComponent } from './documents/documents.component';
import { PricesComponent } from './prices/prices.component';
import { SupportComponent } from './support/support.component';
import { DriverComponent } from './driver/driver.component';
import { DriverDocumentsComponent } from './driver-documents/driver-documents.component';
import { RiderComponent } from './rider/rider.component';

import { AutocompleteComponent } from './autocomplete/autocomplete.component';
import { AddCardComponent } from './add-card/add-card.component';
import { EnrouteChatComponent } from './enroute-chat/enroute-chat.component';

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
        CartypeComponent,
        DocumentsComponent,
        PricesComponent,
        SupportComponent,
        DriverComponent,
        DriverDocumentsComponent,
        RiderComponent,
        AutocompleteComponent,
        AddCardComponent,
        EnrouteChatComponent
    ],
    exports: [
        OtpComponent,
        CountrySearchModalComponent,
        CartypeComponent,
        DocumentsComponent,
        PricesComponent,
        SupportComponent,
        DriverComponent,
        DriverDocumentsComponent,
        RiderComponent,
        AutocompleteComponent,
        AddCardComponent,
        EnrouteChatComponent
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ComponentsModule { }
