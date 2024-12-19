import { Injectable, NgZone } from '@angular/core';
import { throwError } from 'rxjs';
 import { GoogleMap, MapType } from '@capacitor/google-maps';
import { environment } from 'src/environments/environment';
import { GeocodeService } from './geocode.service';
import { OverlayService } from './overlay.service';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  LatLng: { lat: any; lng: any; };
  locationAddress: string = 'Loading..';
  showResetLocationButton: boolean;
  mapPinStage: any;
  D_LatLng: { lat: any; lng: any; };
  actualLocation: any;
   exampleMapId: any;
  newMap: GoogleMap;

  constructor(private overlay: OverlayService, private geocode: GeocodeService) {
   }

  //create google maps get the map movement listener
  async createMap( ref, coords ) {
    try{
     this.newMap = await GoogleMap.create({
       id: 'my-cool-map',
       element: ref,
       apiKey: environment.apiKey,
       config: {
         center: {
           lat: 5.5122138,
           lng: 7.4919135
         },
         zoom: 8,
       },
     });
 
     this.LatLng =  {
       lat: coords.coords.latitude,
       lng: coords.coords.longitude
     }

     this.newMap.enableTrafficLayer(true);
     this.newMap.enableCurrentLocation(true);
     
     await this.newMap.setCamera({
       animate: true,
       animationDuration: 500,
       zoom: 15,
       coordinate: this.LatLng
     })
     try {
      const address = await this.geocode.getAddress(this.LatLng.lat, this.LatLng.lng).toPromise();
      this.actualLocation = address.results[0].formatted_address;
      this.locationAddress = address.results[1].address_components[0].long_name + ' ' + address.results[1].address_components[1].long_name;
    } catch (error) {
      console.error('Error fetching address:', error);
    }
        this.newMap.enableCurrentLocation(true);
   }catch(e){
      this.overlay.showAlert('Error', e)
   }
 }

 


 calculateCenter(points) {
  const latitudes = points.map(p => p.geoCode.latitude);
  const longitudes = points.map(p => p.geoCode.longitude);

  const avgLat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
  const avgLng = longitudes.reduce((a, b) => a + b, 0) / longitudes.length;

  return { latitude: avgLat, longitude: avgLng };
}


 getBoundsZoomLevel(bounds, mapDim) {
  const WORLD_DIM = { height: 256, width: 256 };
    const ZOOM_MAX = 21;

    const latRad = lat => {
      const sin = Math.sin((lat * Math.PI) / 180);
      const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
      return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
    };

    const zoom = (mapPx, worldPx, fraction) =>
      Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const latFraction = (latRad(ne.lat()) - latRad(sw.lat())) / Math.PI;

    const lngDiff = ne.lng() - sw.lng();
    const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

    const latZoom = zoom(mapDim.height, WORLD_DIM.height, latFraction);
    const lngZoom = zoom(mapDim.width, WORLD_DIM.width, lngFraction);

    return Math.min(latZoom, lngZoom, ZOOM_MAX);
}


async setCameraToLocation(coordinate: { lat: number; lng: number }, zoom: number, bearing: any) {
  if (this.newMap) {
    try {
      await this.newMap.setCamera({
        animate: true,
        animationDuration: 500,
        zoom: zoom,
        coordinate: coordinate,
        bearing: bearing
      });
    } catch (error) {
      console.error('Error setting camera:', error);
    }
  } else {
    console.error('Map is not initialized.');
  }
}
// Add other necessary methods like getAddress here


calculateBearing(start, end) {
  const startLat = start.lat * (Math.PI / 180);
  const startLng = start.lng * (Math.PI / 180);
  const endLat = end.lat * (Math.PI / 180);
  const endLng = end.lng * (Math.PI / 180);

  const dLng = endLng - startLng;
  const y = Math.sin(dLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
  const bearing = Math.atan2(y, x) * (180 / Math.PI);

  return (bearing + 360) % 360;
}

 
 
 
}
