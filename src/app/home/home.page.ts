import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { ModalController, Platform, NavController, ToastController, ActionSheetController, AlertController, ModalOptions } from '@ionic/angular';
import { OverlayService } from '../services/overlay.service';
import { GeocodeService } from '../services/geocode.service';
import { MapService } from '../services/map.service';
import { AvatarService } from '../services/avatar.service';
import { Drivers } from '../interfaces/drivers';
import { BehaviorSubject, interval, Observable, Subscription, timer } from 'rxjs';
import { doc, onSnapshot, Firestore, updateDoc, deleteField, getDoc, collection, addDoc, setDoc, serverTimestamp } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Marker, Polyline } from '@capacitor/google-maps';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { LatLng } from '@capacitor/google-maps/dist/typings/definitions';
import { LatLngLiteral } from '@googlemaps/google-maps-services-js';
import { switchMap } from 'rxjs/operators';
import { App } from '@capacitor/app';
import { EnrouteChatComponent } from '../enroute-chat/enroute-chat.component';


declare var google;
declare var window: any; // Declare window to access BackgroundGeolocation

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements AfterViewInit {
  profile = null;
  @ViewChild('map') mapRef: ElementRef<HTMLElement>;
  @ViewChild('mapElement') mapElement: ElementRef<HTMLElement>;
  @ViewChild('topBar', { static: false }) topBar: ElementRef<HTMLElement>;
  @ViewChild('bottomBar', { static: false }) bottomBar: ElementRef<HTMLElement>;
  private routeUpdateSubscription: Subscription;

  address: any = 'Unknown';
  bookingStage: any = false;
  confirmStage: any = false;
  trackingStage: any = false;
  drivingToDestinationStage: any = false;
  data: any;
  cash: any = false;
  state: any = [];
  mapPinStage: boolean;
  DestinationLatLng: { lat: any; lng: any; };
  mapPinDrag: any;
  showResetLocationButton: any = false;
  showloader: boolean;
  mapClass: any;
  destinationAddress: string = 'Drag To Pick Destination';
  locationAddress: string = 'Loading...';
  distance: any;
  direction: any;
  actualDestination: any;
  markers: any;
  allDrivers: Observable<Drivers[]>;
  NoDrivers: boolean;
  driverMarker: string;
  driver_duration_apart: number;
  driver_number_of_seats: any;
  price: any = 0;
  carname: any;
  driver_ID: any;
  bounds: any;
  DriverLatLng: { lat: any; lng: any; };
  driver_marker: any;
  driver_marker1: any;
  destinationMarker1: any;
  drivers_Requested: any[];
  current_Request_Number: number = -1;
  Driver_Rejected: any;
  numCalls: any;
  currentDriver: any;
  unsubscribe: import("@angular/fire/firestore").Unsubscribe;
  driverInfo: import("@angular/fire/firestore").DocumentData;
  currentState: boolean;
  duration: any;
  riderCleared: any;
  updateDriverSubcription: any;
  canCheck: boolean;
  rider_marker: any;
  marker1: any;
  marker2: any;
  actualLocation: string;
  LatLng: { lat: number; lng: number; };
  mapy: boolean;
  AllCarMarkers: Marker[];
  _carmarkers: any[];
  cards: import("@angular/fire/firestore").DocumentData[];
  selected: any;
  selectedCard: any;
  closeDrivers: any;
  approve: boolean = true;

  canStart: any;
  countDown: any;
  riderDestination: any;
  acceptedState: boolean = false;
  distanceText: any;
  durationText: any;
  driverCleared: boolean;
  FCOUNT: boolean;
  riderInfo: import("@angular/fire/firestore").DocumentData;
  earnings: any;
  coordinates: Position;
  driverData: import("@angular/fire/firestore").DocumentData;
  riderLocation: { lat: number, lng: number } | null = null;
  destinationMarker: string;
  newPoly: string[];
  animatedMarker: any;
  private countdownStarted = false;
  private countdownInterval: any;
  rideLostShown: boolean;
  isConnected: any;
  private networkStatus$ = new BehaviorSubject<boolean>(true);
  router: any;
  routePolyline: any;
  countdownTimer: any;
  localCountdown: any;
  countdownWatcher: import("@angular/fire/firestore").Unsubscribe;
  canShowButton: boolean = false;
  removed: any;
  backButtonSubscription: any;
  requestID: any;


  constructor(
    private auth: Auth,
    public map: MapService,
    private firestore: Firestore,
    private readonly database: AvatarService,
    private ngZone: NgZone,
    private geocode: GeocodeService,
    private overlay: OverlayService,
    private cdr: ChangeDetectorRef,
    private toastController: ToastController,
    private actionSheetController: ActionSheetController,
    private platform: Platform,
    private alertController: AlertController,
    private modalCtrl: ModalController
  ) {}

  async ngAfterViewInit() {
    try {
      this.EnterBookingStage();
      await Geolocation.checkPermissions();
      const coordinates = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      this.coordinates = coordinates;
      await this.initializeNetworkMonitoring();

      

      await this.fetchOnlineState();
      
      await this.map.createMap(this.mapRef.nativeElement, coordinates);
      this.mapy = true;

      this.setMapHeight();
      window.addEventListener('resize', this.setMapHeight.bind(this));
      this.initializeBackButtonCustomHandler();
  
      this.LatLng = {
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude,
      };
      this.database.updateDriverLocation(this.LatLng);
  
      this.DestinationLatLng = {
        lat: coordinates.coords.latitude,
        lng: coordinates.coords.longitude,
      };
  
      this.database.getEarnings().subscribe(async (d) => {
        this.earnings = d.Earnings;
      });
  
      this.database.getCards().subscribe(async (d) => {
        this.cards = d;
        this.approve = false;
        this.cards.forEach((element) => {
          if (element.selected) {
            this.selected = element;
            this.selectedCard = element.name;
          }
        });
      });
  
      await this.handleDriverRequestSnapshot();
  
      this.actualLocation = this.map.actualLocation;
      this.locationAddress = this.map.locationAddress;
  
      this.map.newMap.setOnCameraIdleListener(() => {
        this.ngZone.run(() => {
          this.showResetLocationButton = true;
        });
      });

      
    } catch (e) {
      this.overlay.showAlert('Error', e);
    }
  
    // Start polling position
    this.startPollingPosition();
  
    // Start background geolocation for mobile devices
   await this.checkPlatform();
  }


  private async initializeNetworkMonitoring() {
    const status = await Network.getStatus();
    this.isConnected = status.connected;
    this.networkStatus$.next(this.isConnected);
    console.log('Network monitoring initialized. Initial status:', this.isConnected);

    Network.addListener('networkStatusChange', (status) => {
      console.log('Network status changed:', status);
      this.isConnected = status.connected;
      this.networkStatus$.next(this.isConnected);
    });

    this.networkStatus$.subscribe((isConnected) => {
      if (isConnected) {
        this.router.navigate(['tabs']);
      } else {
        this.router.navigate(['network']);
      }
    });
  }


  initializeBackButtonCustomHandler() {
    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(10, () => {
      this.handleBackButton();
    });
  }

  handleBackButton() {
    if (this.bookingStage) {
      this.showExitConfirmation();
    } else if (this.confirmStage) {
      this.ResetState();
    } else if (this.trackingStage) {
      this.showCancelRideConfirmation();
    } else if (this.drivingToDestinationStage) {
      this.showCannotExitAlert();
    }
  }

  async showExitConfirmation() {
    const alert = await this.alertController.create({
      header: 'Exit App',
      message: 'Are you sure you want to exit the app?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Exit',
          handler: () => {
            navigator['app'].exitApp();
          }
        }
      ]
    });
    await alert.present();
  }

  async showCancelRideConfirmation() {
    const alert = await this.alertController.create({
      header: 'Cancel Ride',
      message: 'Are you sure you want to cancel this ride?',
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Yes',
          handler: () => {
            // Implement logic to cancel the ride
            console.log('Ride cancelled');
            this.presentCancelRideActionSheet();
          }
        }
      ]
    });
    await alert.present();
  }

  async showCannotExitAlert() {
    const alert = await this.alertController.create({
      header: 'Cannot Exit',
      message: 'You cannot exit the app during an active trip.',
      buttons: ['OK']
    });
    await alert.present();
  }

  async checkPlatform() {
    const info = await Device.getInfo();
    if (info.platform === 'ios' || info.platform === 'android') {
      this.startBackgroundGeolocation();
    }
  }

  async startPollingPosition() {
    const pollInterval = 5000; // Polling interval in milliseconds
  
    const updatePosition = async () => {
      try {
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
        this.DriverLatLng = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        this.database.updateDriverLocation(this.DriverLatLng);
      } catch (error) {
        console.error('Error getting position:', error);
      }
      setTimeout(updatePosition, pollInterval); // Poll every pollInterval milliseconds
    };
  
    updatePosition();
  }


  async checkAndClearIncompleteRide() {
    const user = this.auth.currentUser;
    if (user) {
      const driverDocRef = doc(this.firestore, 'Drivers', user.uid);
      const driverDoc = await getDoc(driverDocRef);
      const driverData = driverDoc.data();
  
      if (driverData && driverData.currentRequestId) {
        const requestRef = doc(this.firestore, 'Request', driverData.currentRequestId);
        const requestDoc = await getDoc(requestRef);
        const requestData = requestDoc.data();
  
        if (requestData && requestData.status !== 'completed') {
          // Clear currentRequestId if the ride is not completed
          await this.clearCurrentRequestId(user.uid);
          this.lastHandledState = null;
          console.log('Cleared incomplete ride on app restart.');
        }
      }
    }
  }

  async startBackgroundGeolocation() {
    try {
      const options = {
        stationaryRadius: 50,
        distanceFilter: 50,
        desiredAccuracy: 10,
        debug: true,
        notificationTitle: 'Background tracking',
        notificationText: 'enabled',
        startOnBoot: true,
        stopOnTerminate: false,
        locationProvider: window.BackgroundGeolocation.provider.ANDROID_ACTIVITY_PROVIDER,
        interval: 60000,
        fastestInterval: 5000,
        activitiesInterval: 10000,
        stopOnStillActivity: false,
      };
  
      window.BackgroundGeolocation.configure(options);
  
      window.BackgroundGeolocation.on('location', (location) => {
        console.log('Location update: ', location);
        this.DriverLatLng = {
          lat: location.latitude,
          lng: location.longitude,
        };
        this.database.updateDriverLocation(this.DriverLatLng);
      });
  
      window.BackgroundGeolocation.start();
    } catch (e) {
      console.error('BackgroundGeolocation configuration error: ', e);
    }
  }
  
  stopBackgroundGeolocation() {
    window.BackgroundGeolocation.stop();
  }
  

  getRiderLocation(driverId: string): void {
    this.database.getRiderLocation(driverId)
    .then(location => {
      this.riderLocation = location;
      this.DestinationLatLng = {
        lat: this.riderLocation.lat,
        lng: this.riderLocation.lng,
      };
      console.log(this.riderLocation); // For testing purposes
    })
    .catch(error => {
      console.error('Error fetching driver location:', error);
    });
  }


  lastHandledState: string | null = null;

  private driverRequestUnsubscribe: () => void;

  async handleDriverRequestSnapshot() {
    this.auth.onAuthStateChanged((user) => {
      if (user) {
        const driverDocRef = doc(this.firestore, 'Drivers', user.uid);
        onSnapshot(driverDocRef, async (driverDoc) => {
          this.driverData = driverDoc.data();
          if (this.driverData && this.driverData.currentRequestId) {
            const requestRef = doc(this.firestore, 'Request', this.driverData.currentRequestId);
            if (this.driverRequestUnsubscribe) {
              this.driverRequestUnsubscribe();
            }
            this.driverRequestUnsubscribe = onSnapshot(requestRef, async (doc) => {
              console.log("It happened Here", doc.data());
              this.riderInfo = doc.data();
              if (this.riderInfo && this.lastHandledState !== this.riderInfo.status) {
                console.log("Should trigger", this.riderInfo.status);
                this.lastHandledState = this.riderInfo.status; // Update the last handled state
                switch (this.riderInfo.status) {
                  case 'cancelled':
                    await this.handleCancelledState(this.riderInfo);
                    break;
                  case 'pending':
                    await this.handlePendingState(this.riderInfo);
                    break;
                  case 'confirmed':
                    await this.handleConfirmedState(this.riderInfo);
                    break;
                  case 'started':
                    await this.handleStartedState(this.riderInfo);
                    break;
                  case 'stopped':
                    await this.handleStoppedState(this.riderInfo);
                    break;
                  default:
                    console.error('Unknown ride status:', this.riderInfo.status);
                    break;
                }
              }
            });
          }
        });
      }
    });
  }


  
  async handlePendingState(doco) {
    try {

    console.log('Handling the pending state:', doco);
    const userDocRef = doc(this.firestore, `Riders`, doco.Rider_id);
  
    const docSnapshot = await getDoc(userDocRef);
  
    if (docSnapshot.exists()) {
      console.log("I'm here!!!!!!!!!!");
  
      if (!this.acceptedState) {
        if (!this.countdownStarted) {
          this.countdownStarted = true; // Flag to ensure countdown starts only once
           
          // Initial state setup
          this.EnterConfirmStage();
          this.cash = !doco.card;

          this.DestinationLatLng = {
            lat: this.riderInfo.Des_lat,
            lng: this.riderInfo.Des_lng,
          };
  
          this.getDistanceandDirections();
          this.map.newMap.enableCurrentLocation(false);
  
          // Start the countdown watcher
          this.watchCountdown(doco);
        }
      }
    }
  } catch (e) {
    this.overlay.showAlert('Confirm Error', e);
  }
  }
  
  
  watchCountdown(doco) {
    const requestRef = doc(this.firestore, 'Request', doco.requestId);
    this.requestID = doco.requestId;
    
    const countdownWatcher = onSnapshot(requestRef, async (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const currentCountdown = data.countDown;
  
        console.log('Current countdown:', currentCountdown);
  
        if (currentCountdown <= 1) {
          await this.checkAndClearIncompleteRide();
          this.ClearRide();
          this.FCOUNT = true;
          this.lastHandledState = null;
          this.overlay.showAlert('Lost', 'Ride Lost');
          countdownWatcher(); // Unsubscribe from changes
          this.acceptedState = false;
        }
      } else {
        console.error('Ride request document does not exist.');
      }
    });
  
    this.countdownWatcher = countdownWatcher; // Store the unsubscribe function if needed
  }
  
  

  
async UpdateCountDown(time, requestId) {
  try {
    const requestDocRef = doc(this.firestore, "Request", requestId);
    await updateDoc(requestDocRef, { countDown: time });
    return true;
  } catch (e) {
    console.log(e);
    return null;
  }
}

async startCountdown(initialTime, requestId) {
  let timeRemaining = initialTime;

  const updateCountdown = async () => {
    if (timeRemaining > 0) {
      await this.UpdateCountDown(timeRemaining, requestId);
     // this.updatePieChart(timeRemaining, initialTime);
      timeRemaining--;
      setTimeout(updateCountdown, 1000); // Update every second
    }
  };

  updateCountdown();
}

  

  
  async completeRideAndProcessPayment(doc) {
    // Complete the ride, process payment, and update ride history
    const rideData = doc;
    console.log("This is the ride data: ", rideData)
    await this.processPayment(rideData);
    await this.updateRideHistory(rideData);
    
    
  }
  
  async processPayment(rideData) {
    // Logic to process payment
    console.log('Processing payment for ride:', rideData);
    // Example: Call a payment API and update Firestore with payment status
    const Drivershare = (80 / 100) * rideData.price;
    const amt = rideData.price - Drivershare;
    await this.database.updateEarnings(amt + this.earnings)
  }
  
  async updateRideHistory(rideData) {
    // Logic to update ride history
    console.log('Updating ride history for ride:', rideData);
    // Example: Add ride data to a 'RideHistory' collection in Firestore
    await this.database.createHistory(rideData);

  }
  

  async clearCurrentRequestId(driverId: string) {
    const driverDocRef = doc(this.firestore, 'Drivers', driverId);
    await updateDoc(driverDocRef, {
      currentRequestId: deleteField()
    });
  }
  
  async handleConfirmedState(doc) {
      await this.ResetState();
      
      await this.getRiderLocation(this.riderInfo.Rider_id);

      console.log("This Doc data: " + doc);
      
      this.DestinationLatLng = {
        lat: (this.riderLocation && this.riderLocation.lat) ? this.riderLocation.lat : this.riderInfo.Loc_lat,
        lng: (this.riderLocation && this.riderLocation.lng) ? this.riderLocation.lng : this.riderInfo.Loc_lng,
      };
      
      console.log("Rider Location: ", this.DriverLatLng, this.DestinationLatLng);
      this.overlay.showLoader('Please Wait...');
      await this.handleDriverToRider(this.DriverLatLng, this.DestinationLatLng);
   
  }
  
  
  
  async handleStartedState(doc) {
      await this.ResetState();

      this.DestinationLatLng = {
          lat: doc.Des_lat,
          lng: doc.Des_lng,
        };
        this.overlay.showLoader('Please Wait...');
    await this.handleRiderToDestination(this.DriverLatLng, this.DestinationLatLng);
  }
  
  async handleStoppedState(doc) {
     
    await this.checkAndClearIncompleteRide();
    // Unsubscribe from the current request listener
    if (this.driverRequestUnsubscribe) {
      this.driverRequestUnsubscribe();
    }

      this.clearPrevMarkers()
      if (this.newPoly) {
        await this.clearPolyline(this.newPoly);
      }
  
    // console.log(doc);
    this.EnterBookingStage();
    await this.ReturnHome();

    // Complete the ride and process payment
    await this.completeRideAndProcessPayment(doc);
    await this.database.updateOnlineState(true);
    this.map.newMap.enableCurrentLocation(true);
    this.acceptedState = false;
  
  }

  setMapHeight() {
      const bottomBarHeight = this.bottomBar.nativeElement.offsetHeight;
      const availableHeight = window.innerHeight - bottomBarHeight;
      this.mapRef.nativeElement.style.height = `${availableHeight}px`;
  }

  setMapHeight2HandleDrivertoRider() {
      const bottomBarHeight = this.bottomBar.nativeElement.offsetHeight + 100;
      const availableHeight = window.innerHeight - bottomBarHeight;
      this.mapRef.nativeElement.style.height = `${availableHeight}px`;
  }

  setMapHeightDrivertoDestination() {
      const bottomBarHeight = this.bottomBar.nativeElement.offsetHeight;
      const availableHeight = window.innerHeight - bottomBarHeight;
      this.mapRef.nativeElement.style.height = `${availableHeight}px`;
  }

  async handleCancelledState(data) {
    console.log(`Ride was cancelled by ${data.canceledBy} for reason: ${data.cancellationReason}`);
  
    if (data.canceledBy == 'rider') {
      this.overlay.showAlert('Cancelled', 'Rider cancelled');
    } 

    this.ClearRide();
    this.removed = true;
    console.log('Ride is cancelled.');
    this.acceptedState = false;
    // Clear currentRequestId in driverData
    const driverDocRef = doc(this.firestore, 'Drivers', this.auth.currentUser.uid);
    await updateDoc(driverDocRef, { currentRequestId: null });
    await this.database.updateOnlineState(true);
    await this.fetchOnlineState()
  }


  async EnterChat(): Promise<void> {
    const options: ModalOptions = {
        component: EnrouteChatComponent,
        componentProps: {
            userId: this.requestID,
            message: ""
        },
        swipeToClose: true,
    };
    
    const modal = await this.modalCtrl.create(options);
    return await modal.present();
    }


  startTimer(sec) {
    const nop = interval(1000).subscribe(async () => {
      await this.database.updateCountDown(sec);
      sec--;
      if (sec == 0) {
        nop.unsubscribe();
      }
    });
  }

  async chooseCard(event) {
    try {
      this.overlay.showLoader('Selecting Card..');
      await this.database.updateCard(this.selected.name, this.selected.number, this.selected.type, this.selected.id, false);
      for (const element of this.cards) {
        if (element.name == event) {
          await this.database.updateCard(element.name, element.number, element.type, element.id, true);
          this.overlay.hideLoader();
        }
      }
    } catch (e) {
      this.overlay.showAlert('Error', JSON.stringify(e));
    }
  }

  async AcceptRide() {
    try {
      this.acceptedState = true;
      const requestRef = doc(this.firestore, 'Request', this.driverData.currentRequestId);
      await updateDoc(requestRef, { status: 'confirmed' });
    } catch (e) {
      this.overlay.showAlert('Error', JSON.stringify(e));
      // Retry or provide user feedback
    }
  }

  async resetLocation(): Promise<void> {
    await this.map.newMap.setCamera({
      animate: true,
      animationDuration: 500,
      zoom: 15,
      coordinate: this.LatLng,
    });
    this.showResetLocationButton = false;
  }

  async PickUp() {
    try {
      this.canShowButton = false;
      this.overlay.showLoader('Picking Up..');
      const requestRef = doc(this.firestore, 'Request', this.driverData.currentRequestId);
      await updateDoc(requestRef, { status: 'started' });
      
      this.overlay.hideLoader();
    } catch (e) {
      this.overlay.showAlert('Error', JSON.stringify(e));
    }
  }

  async DropOff() {
    try {
      const requestRef = doc(this.firestore, 'Request', this.driverData.currentRequestId);
      await updateDoc(requestRef, { status: 'stopped' });
    } catch (e) {
      this.overlay.showAlert('Error', JSON.stringify(e));
    }
  }

  async Navigate() {
    // Implementation for navigation
  }

  async fetchOnlineState() {
    try {
      console.log("Fetching online state...");
      const onlineState = await this.database.getOnlineState();
      console.log('Online state fetched from database:', onlineState); // Log the fetched state
      this.currentState = onlineState;
      console.log('Current state updated to:', this.currentState);
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error fetching online state:', e);
      this.overlay.showAlert('Error', 'Failed to fetch online state.');
    }
  }
  




  async SwitchOn() {
    try {
      this.approve = true;
      console.log('Attempting to go online...');
      await this.database.updateOnlineState(true);
      await this.fetchOnlineState(); // Fetch the current state from the database
      console.log('Successfully went online.');
    } catch (e) {
      console.error('Error in SwitchOn:', e);
      this.overlay.showAlert('Error', 'Failed to go online.');
    } finally {
      this.approve = false;
      this.cdr.detectChanges();
    }
  }
  
  async SwitchOff() {
    try {
      this.approve = true;
      console.log('Attempting to go offline...');
      await this.database.updateOnlineState(false);
      await this.fetchOnlineState(); // Fetch the current state from the database
      console.log('Successfully went offline.');
    } catch (e) {
      console.error('Error in SwitchOff:', e);
      this.overlay.showAlert('Error', 'Failed to go offline.');
    } finally {
      this.approve = false;
      this.cdr.detectChanges();
    }
  }
  
  
  private async clearPrevMarkers() {
    try {

      // Clear animated marker
      if (this.animatedMarker) {
        await this.clearMarker(this.animatedMarker);
        this.animatedMarker = null;
      }
  
      if (this.routeUpdateSubscription) {
        this.routeUpdateSubscription.unsubscribe();
      }
       // Clear other markers
       if (this.rider_marker) {
        await this.clearMarker(this.rider_marker);
        this.rider_marker = null;
      }
  
      // Clear other markers
      if (this.driver_marker) {
        await this.clearMarker(this.driver_marker);
        this.driver_marker = null;
      }
  
      // Clear other markers
      if (this.destinationMarker) {
        await this.clearMarker(this.destinationMarker);
        this.destinationMarker = null;
      }

       // Clear other markers
       if (this.driver_marker1) {
        await this.clearMarker(this.driver_marker1);
        this.driver_marker1 = null;
      }
  
      // Clear other markers
      if (this.destinationMarker1) {
        await this.clearMarker(this.destinationMarker1);
        this.destinationMarker1 = null;
      }
  
      // Clear other markers
      if (this.marker1) {
        await this.clearMarker(this.marker1);
        this.marker1 = null;
      }
  
      if (this.marker2) {
        await this.clearMarker(this.marker2);
        this.marker2 = null;
      }
  
      
  
    } catch (e) {
      console.error('Error clearing markers:', e);
    }
  }
  
  
  private async clearMarker(marker) {
    if (marker) {
      try {
        await this.map.newMap.removeMarker(marker);
        console.log("Marker was cleared!");
      } catch (error) {
        console.error('Error clearing marker:', error);
      }
    }
  }
  
  
  
  async clearPolyline(polyline) {
    if (polyline) {
      try {
        await this.map.newMap.removePolylines(polyline);
        console.log('Polyline cleared:', polyline);
        this.newPoly = null;
      } catch (error) {
        console.error('Error clearing polyline:', error);
      }
    } else {
      console.warn('No polyline to clear');
    }
  }
  
  async ResetState(){
    try{
      // Clear previous markers
      await this.clearPrevMarkers();
  
      // Clear any existing polylines
      if (this.newPoly) {
        await this.clearPolyline(this.newPoly);
      }
  
      const availableHeight = 1024;
  
      this.map.newMap.enableTouch();
  
      this.setMapHeight();
      window.addEventListener('resize', this.setMapHeight.bind(this));
  
      // Ensure the map respects the boundaries of the top and bottom bars
      this.mapRef.nativeElement.style.height = `${availableHeight}px`;
  
      // // Start watching the user's position
      // this.startPollingPosition();
      
    }catch(e){
      throw new Error(e);
      
    }
  }
  
  
  

  async getDistanceandDirections() {
    try {
      if (!this.canStart) {
       

        console.log('LatLng:', this.DriverLatLng);

        const origin1 = new google.maps.LatLng(this.DriverLatLng.lat, this.DriverLatLng.lng);
        const origin2 = new google.maps.LatLng(this.DestinationLatLng.lat, this.DestinationLatLng.lng);

        const request = {
          origin: origin1,
          destination: origin2,
          travelMode: google.maps.TravelMode.DRIVING,
        };

        console.log('Directions request:', request);

        this.geocode.directions.route(request, async (response, status) => {
          console.log('Directions request status:', status);
          if (status === 'OK') {
            this.direction = response;
            this.canStart = false;
            this.distance = response.routes[0].legs[0].distance.value;

            console.log('Directions response:', response);
            console.log("Should Happen here.");

            this.distanceText = response.routes[0].legs[0].distance.text;
            this.durationText = response.routes[0].legs[0].duration.text;

            console.log('distanceText:', this.distanceText);
            console.log('durationText:', this.durationText);

            this.bounds = response.routes[0].bounds;

            this.setMapHeight();
            window.addEventListener('resize', this.setMapHeight.bind(this));

            await this.createAndAddMarkers(this.DriverLatLng, this.DestinationLatLng);
          } else {
            this.overlay.showAlert('Error', `Failed to get directions: ${status}`);
            this.canStart = false; // Reset canStart in case of error
          }
        });
        this.canStart = true;
      }
    } catch (e) {
      console.error('Error in getDistanceandDirections:', e);
      this.overlay.showAlert('Error', JSON.stringify(e));
      this.canStart = false; // Reset canStart in case of error
    }
  }

  async ReturnHome() {
    try {
      this.canStart = false;
      this.distanceText = null;
      this.durationText = null;
      this.riderInfo = null;
      clearInterval(this.countdownInterval);
      this.countdownStarted = false;
      this.rideLostShown = false;

      await this.ResetState();
      this.EnterBookingStage();
      await this.map.newMap.setCamera({
        animate: true,
        animationDuration: 500,
        zoom: 15,
        coordinate: this.LatLng,
      });
       // Optionally, you can re-subscribe to the listener here if needed
       await this.database.updateOnlineState(true);
       await this.fetchOnlineState();
       await this.handleDriverRequestSnapshot();
       this.removed = false;
    } catch (e) {
      this.overlay.showAlert('Error', JSON.stringify(e));
    }
  }

  async presentCancelRideActionSheet() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Cancel Ride',
      buttons: [
        {
          text: 'Changed my mind',
          handler: () => {
            this.cancelRide('Changed my mind');
          }
        },
        {
          text: 'Driver took too long',
          handler: () => {
            this.cancelRide('Driver took too long');
          }
        },
        {
          text: 'Found another ride',
          handler: () => {
            this.cancelRide('Found another ride');
          }
        },
        {
          text: 'Other',
          handler: () => {
            this.cancelRide('Other');
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }
  
  async cancelRide(reason: string) {
   
    this.driverCleared = true;
    this.overlay.showLoader('Cancelling Ride..');
    const rideRef = doc(this.firestore, 'Request', this.driverData.currentRequestId);
    const rideSnapshot = await getDoc(rideRef);
    const rideData = rideSnapshot.data();
    await updateDoc(rideRef, {
      status: 'cancelled',
      cancellationReason: reason,
      canceledBy: 'driver'
    });
     // Create a new document in the cancelledRides collection
     const cancelledRideRef = doc(collection(this.firestore, 'CancelledRides'));
     await setDoc(cancelledRideRef, {
       ...rideData,
       status: 'cancelled',
       cancellationReason: reason,
       canceledBy: 'rider',
       cancelledAt: serverTimestamp(),
       originalRequestId: this.requestID
     });
    const toast = await this.toastController.create({
      message: 'Ride has been cancelled.',
      duration: 2000
    });
    this.overlay.hideLoader();
    this.ReturnHome();
    await toast.present();
  }

  async ClearRide() {
    try {
      this.ReturnHome();
    } catch (e) {
      this.overlay.showAlert('Error', JSON.stringify(e));
    }
  }

  async createAndAddMarkers(loc, des) {
    const markerSize = { width: 30, height: 30 };
    const iconAnchor = { x: 10, y: 0 }; // Center bottom of the icon
  
    try {
      this.map.newMap.disableTouch();
  
      // Add start marker
      this.marker1 = await this.map.newMap.addMarker({
        coordinate: loc,
        iconUrl: 'assets/icon/point.png',
        title: 'Start',
        iconSize: markerSize,
        iconAnchor: iconAnchor,
        iconOrigin: { x: 1, y: 0 },
      });
  
      // Add destination marker
      this.marker2 = await this.map.newMap.addMarker({
        coordinate: des,
        iconUrl: 'assets/icon/flag.png',
        title: 'Destination',
        iconSize: markerSize,
        iconAnchor: iconAnchor,
        iconOrigin: { x: 1, y: 0 },
      });
  
      // Calculate the center point between the start and destination
      const locs = [
        { geoCode: { latitude: loc.lat, longitude: loc.lng } },
        { geoCode: { latitude: des.lat, longitude: des.lng } },
      ];
  
      const center = this.map.calculateCenter(locs);
  
      // Calculate the bounds
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(new google.maps.LatLng(loc.lat, loc.lng));
      bounds.extend(new google.maps.LatLng(des.lat, des.lng));
  
      // Set map height before calculating zoom level
      const availableHeight = this.mapRef.nativeElement.offsetHeight;
  
      // Prepare map dimensions for calculating zoom level
      const mapDim = {
        height: availableHeight,
        width: this.mapRef.nativeElement.offsetWidth,
      };
  
      // Calculate zoom level
      const zoomLevel = this.map.getBoundsZoomLevel(bounds, mapDim);

      console.log(loc.lat,  loc.lng);
      console.log(des.lat,  des.lng);
  
  
      // Manually set zoom level if needed
      const adjustedZoomLevel = zoomLevel - 1; // Adjust as necessary
  
       await this.map.setCameraToLocation({ lat: center.latitude, lng: center.longitude }, adjustedZoomLevel, this.map.calculateBearing(loc, des));
  

  
      // Add polyline between the start and destination
      await this.addPolyline(loc, des);
  
    } catch (error) {
      console.error('Error adding markers and polyline:', error);
    }
  }


  // Interval in milliseconds for updating the route
UPDATE_INTERVAL = 10000; // Update every 10 seconds

async handleDriverToRider(driverLatLng, riderLatLng) {
  const markerSize = { width: 30, height: 30 };
  const iconAnchor = { x: 10, y: 0 }; // Center bottom of the icon
  let stageTransitioned = false;

  try {
    // Add driver marker at the starting position
    const driverMarker = await this.map.newMap.addMarker({
      coordinate: driverLatLng,
      iconUrl: 'assets/icon/car.png',
      title: 'Driver',
      iconSize: markerSize,
      iconAnchor: iconAnchor,
      iconOrigin: { x: 2, y: 0 },
    });
    this.driver_marker = driverMarker;

    // Add rider marker at the destination position
    const riderMarker = await this.map.newMap.addMarker({
      coordinate: riderLatLng,
      iconUrl: this.database.user.photoURL, // Change this to your rider icon URL
      title: 'Rider',
      iconSize: markerSize,
      iconAnchor: iconAnchor,
      iconOrigin: { x: 2, y: 0 },
    });
    this.rider_marker = riderMarker;

    // Function to update route, duration, and distance
    const updateRoute = async () => {
      const request = {
        origin: driverLatLng,
        destination: riderLatLng,
        travelMode: google.maps.TravelMode.DRIVING,
      };

      this.geocode.directions.route(request, async (response, status) => {
        if (status === 'OK') {
          const path = response.routes[0].overview_path.map(latlng => ({
            lat: latlng.lat(),
            lng: latlng.lng()
          }));
          this.duration = response.routes[0].legs[0].duration.text;
          this.distance = response.routes[0].legs[0].distance.text;

          console.log(`Duration: ${this.duration}, Distance: ${this.distance}`);

          const locs = [
            { geoCode: { latitude: driverLatLng.lat, longitude: driverLatLng.lng } },
            { geoCode: { latitude: riderLatLng.lat, longitude: riderLatLng.lng } },
          ];

          const center = this.map.calculateCenter(locs);


          const bounds = new google.maps.LatLngBounds();
          bounds.extend(new google.maps.LatLng(driverLatLng.lat, driverLatLng.lng));
          bounds.extend(new google.maps.LatLng(riderLatLng.lat, riderLatLng.lng));
  
        
          const availableHeight = this.mapRef.nativeElement.offsetHeight;
  
          // Prepare map dimensions for calculating zoom level
          const mapDim = {
            height: availableHeight,
            width: this.mapRef.nativeElement.offsetWidth,
          };
  
          // Calculate zoom level
          const zoomLevel = this.map.getBoundsZoomLevel(bounds, mapDim);
  
          // Manually set zoom level if needed
          const adjustedZoomLevel = zoomLevel - 1; // Adjust as necessary
  
         await this.map.setCameraToLocation({ lat: center.latitude, lng: center.longitude }, adjustedZoomLevel, this.map.calculateBearing(driverLatLng, riderLatLng));
  

          // Update polyline for the route
          if (this.newPoly) {
            await this.clearPolyline(this.newPoly);
           }
           await this.addPolyline(driverLatLng, riderLatLng);

            // Call EnterDrivingToDestinationStage after determining duration and distance
          if (!stageTransitioned) {
            this.EnterTrackingStage();
            this.setMapHeightDrivertoDestination();
            window.addEventListener('resize', this.setMapHeightDrivertoDestination.bind(this));
            stageTransitioned = true;
            this.overlay.hideLoader();
          }

          // Animate the driver marker along the path to the rider
          await this.animateMarker(this.driver_marker, path, 'assets/icon/car.png');
        } else {
          console.error('Direction ERROR:', response);
          this.overlay.showAlert('Direction ERROR', JSON.stringify(response));
        }
      });
    };

    // Start updating the route periodically
    const routeUpdate$ = interval(this.UPDATE_INTERVAL).pipe(
      switchMap(() => updateRoute())
    );

    // Subscribe to the interval observable to start updating
    this.routeUpdateSubscription = routeUpdate$.subscribe();

    // Cleanup subscription when the component or context is destroyed
    // Call routeUpdateSubscription.unsubscribe() when needed

  } catch (error) {
    console.error('Error handling driver to rider:', error);
  }
}

async handleRiderToDestination(driverLatLng, destinationLatLng) {
  const markerSize = { width: 30, height: 30 };
  const iconAnchor = { x: 10, y: 0 }; // Center bottom of the icon
  let stageTransitioned = false;

  try {
    // Update driver marker to driver's current position
    const driverMarker = await this.map.newMap.addMarker({
      coordinate: driverLatLng,
      iconUrl: 'assets/icon/car.png',
      title: 'Driver',
      iconSize: markerSize,
      iconAnchor: iconAnchor,
      iconOrigin: { x: 0, y: 0 },
    });
    this.driver_marker1 = driverMarker;

    // Add destination marker
    const destinationMarker = await this.map.newMap.addMarker({
      coordinate: destinationLatLng,
      iconUrl: 'assets/icon/flag.png',
      title: 'Destination',
      iconSize: markerSize,
      iconAnchor: iconAnchor,
      iconOrigin: { x: 0, y: 0 },
    });
    this.destinationMarker1 = destinationMarker;

    // Function to update route, duration, and distance
    const updateRoute = async () => {
      const request = {
        origin: driverLatLng,
        destination: destinationLatLng,
        travelMode: google.maps.TravelMode.DRIVING,
      };

      this.geocode.directions.route(request, async (response, status) => {
        if (status === 'OK') {
          const path = response.routes[0].overview_path.map(latlng => ({
            lat: latlng.lat(),
            lng: latlng.lng()
          }));
          this.duration = response.routes[0].legs[0].duration.text;
          this.distance = response.routes[0].legs[0].distance.text;

          const locs = [
            { geoCode: { latitude: driverLatLng.lat, longitude: driverLatLng.lng } },
            { geoCode: { latitude: destinationLatLng.lat, longitude: destinationLatLng.lng } },
          ];

          const center = this.map.calculateCenter(locs);

          const bounds = new google.maps.LatLngBounds();
          bounds.extend(new google.maps.LatLng(driverLatLng.lat, driverLatLng.lng));
          bounds.extend(new google.maps.LatLng(destinationLatLng.lat, destinationLatLng.lng));

          const availableHeight = this.mapRef.nativeElement.offsetHeight;

          // Prepare map dimensions for calculating zoom level
          const mapDim = {
            height: availableHeight,
            width: this.mapRef.nativeElement.offsetWidth,
          };

          // Calculate zoom level
          const zoomLevel = this.map.getBoundsZoomLevel(bounds, mapDim);

          // Manually set zoom level if needed
          const adjustedZoomLevel = zoomLevel - 1; // Adjust as necessary

          
          await this.map.setCameraToLocation({ lat: center.latitude, lng: center.longitude }, adjustedZoomLevel, this.map.calculateBearing(driverLatLng, destinationLatLng));
  


          console.log(`Duration: ${this.duration}, Distance: ${this.distance}`);

          // // Update polyline for the route
          if (this.newPoly) {
            await this.clearPolyline(this.newPoly);
          }
          await this.addPolyline(driverLatLng, destinationLatLng);

          // Call EnterDrivingToDestinationStage after determining duration and distance
          if (!stageTransitioned) {
            this.EnterDrivingToDestinationStage();
                
            this.setMapHeightDrivertoDestination();
            window.addEventListener('resize', this.setMapHeightDrivertoDestination.bind(this));
            stageTransitioned = true;
            this.overlay.hideLoader();
          }

          // Animate the driver marker along the path to the destination
          await this.animateMarker(this.driver_marker, path, 'assets/icon/car.png');
        } else {
          console.error('Direction ERROR:', response);
          this.overlay.showAlert('Direction ERROR', JSON.stringify(response));
        }
      });
    };

    // Start updating the route periodically
    const routeUpdate$ = interval(this.UPDATE_INTERVAL).pipe(
      switchMap(() => updateRoute())
    );

    // Subscribe to the interval observable to start updating
    this.routeUpdateSubscription = routeUpdate$.subscribe();


  } catch (error) {
    console.error('Error handling rider to destination:', error);
  }
}
  
  

  async animateMarker(marker, path, iconUrl) {
    const markerSize = { width: 50, height: 50 };
    const iconAnchor = { x: 25, y: 50 }; // Center bottom of the icon
  
    const moveMarker = async (i) => {
      if (i >= path.length) return;
  
      await this.map.newMap.removeMarker(marker);
      const coordinate = path[i] instanceof google.maps.LatLng ? 
                         { lat: path[i].lat(), lng: path[i].lng() } : 
                         { lat: path[i].lat, lng: path[i].lng };
      marker = await this.map.newMap.addMarker({
        coordinate: coordinate,
        iconUrl: iconUrl,
        title: 'Moving Marker',
        iconSize: markerSize,
        iconAnchor: iconAnchor,
        iconOrigin: { x: 0, y: 0 },
      });
  
      requestAnimationFrame(() => moveMarker(i + 1));
    };
  
    await moveMarker(0);
  
    // Store the last position of the animated marker
    this.animatedMarker = marker;
  }
  


  async addPolyline(loc: { lat: number, lng: number }, des: { lat: number, lng: number }): Promise<(LatLng | LatLngLiteral)[]> {
    try {
      const polylineColor = "#007bff";
      const polylines: Polyline[] = [
        {
          path: [
            { lat: loc.lat, lng: loc.lng },
            { lat: des.lat, lng: des.lng }
          ],
          strokeColor: polylineColor,
          strokeWeight: 8,
          geodesic: true
        }
      ];
  
      this.newPoly = await this.map.newMap.addPolylines(polylines);
      return polylines[0].path as (LatLng | LatLngLiteral)[]; // Ensure the return type is always an array
    } catch (e) {
      console.log('Error Adding Polyline: ', e);
      return [];
    }
  }
  

ngOnDestroy() {
  this.stopBackgroundGeolocation();
  if (this.routeUpdateSubscription) {
    this.routeUpdateSubscription.unsubscribe();
  }
  if (this.newPoly) {
    this.clearPolyline(this.newPoly);
  }
  window.removeEventListener('resize', this.setMapHeight.bind(this));
}


  EnterBookingStage() {
    this.bookingStage = true;
    this.confirmStage = false;
    this.trackingStage = false;
    this.mapPinStage = false;
    this.drivingToDestinationStage = false;
  }

  EnterConfirmStage() {
    this.bookingStage = false;
    this.confirmStage = true;
    this.trackingStage = false;
    this.mapPinStage = false;
    this.drivingToDestinationStage = false;
  }

  EnterSearchingStage() {
    this.bookingStage = false;
    this.confirmStage = false;
    this.trackingStage = false;
    this.mapPinStage = false;
    this.drivingToDestinationStage = false;
  }

  EnterNoDriverStage() {
    this.bookingStage = false;
    this.confirmStage = false;
    this.trackingStage = false;
    this.mapPinStage = false;
    this.drivingToDestinationStage = false;
  }

  EnterTrackingStage() {
    this.bookingStage = false;
    this.confirmStage = false;
    this.trackingStage = true;
    this.mapPinStage = false;
    this.drivingToDestinationStage = false;
  }

  EnterDrivingToDestinationStage() {
    this.bookingStage = false;
    this.confirmStage = false;
    this.trackingStage = false;
    this.mapPinStage = false;
    this.drivingToDestinationStage = true;
  }
}
