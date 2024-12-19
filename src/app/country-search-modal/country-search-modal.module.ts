// country-search-modal.module.ts

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { CountrySearchModalComponent } from './country-search-modal.component';

@NgModule({
  declarations: [CountrySearchModalComponent],
  imports: [CommonModule, IonicModule],
  exports: [CountrySearchModalComponent] // Export the component
})
export class CountrySearchModalModule {}
