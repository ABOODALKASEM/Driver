import { Injectable } from '@angular/core';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { collection, collectionData, CollectionReference, doc, docData, DocumentData, Firestore, setDoc, updateDoc, deleteDoc, serverTimestamp, addDoc, getDoc, onSnapshot } from '@angular/fire/firestore';
import { getDownloadURL, ref, Storage, uploadString } from '@angular/fire/storage';
import { Photo } from '@capacitor/camera';
import { geohashForLocation } from 'geofire-common';
import { Observable, Subscription } from 'rxjs';
import { Card } from '../interfaces/card';
import { Drivers } from '../interfaces/drivers';
import { Rider } from '../interfaces/rider';
import { AuthService } from './auth.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root',
})
export class AvatarService {
  private driverCollection: CollectionReference<DocumentData>;
  directory: any;
  userUID: string;
  userName: string;
  userEmail: string;
  profile: DocumentData;
  pathM: string;
  private authStateSubscription: () => void;
  isRandom: any;
  user: User;

  constructor(
    private auth: Auth,
    public firestore: Firestore,
    private storage: Storage,
    private authService: AuthService
  ) {
    this.authStateSubscription = onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        this.user = user;

        await this.loadUserProfile();
      } else {
        console.log("Hey");
        this.userName = "None";
      }
    });
  }

  async loadUserProfile() {
    const profileDoc = await getDoc(doc(this.firestore, 'Drivers', this.user.uid));
    if (profileDoc.exists()) {
        this.profile = profileDoc.data();
    } else {
        throw new Error('User profile not found');
    }
}




  
  getUserProfile(user: User): Observable<DocumentData> {
    const userDocRef = doc(this.firestore, `Drivers/${user.uid}`);
    return docData(userDocRef);
  }  

  async rejectRider(): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, "Request", this.auth.currentUser.uid);
      await updateDoc(userDocRef, {
        cancel: true,
        start: false
      });
      await this.updateOnlineState(true);
      return true;
    } catch (e) {
      console.error('Error rejecting rider:', e);
      return false;
    }
  }

  async pickRider(): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, "Request", this.auth.currentUser.uid);
      await updateDoc(userDocRef, {
        start: true,
      });
      return true;
    } catch (e) {
      console.error('Error picking rider:', e);
      return false;
    }
  }

  async endRide(): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, "Request", this.auth.currentUser.uid);
      await updateDoc(userDocRef, {
        stop: true,
        start: false
      });
      return true;
    } catch (e) {
      console.error('Error ending ride:', e);
      return false;
    }
  }

  async saveCarInfo(uid: string, carInfo: any): Promise<void> {
    try {
      await setDoc(doc(this.firestore, `Drivers/${uid}/CarInfo`), carInfo);
    } catch (e) {
      console.error('Error saving car info:', e);
      throw new Error('Error saving car info');
    }
  }

  async saveDriverInfo(uid: string, driverInfo: any): Promise<void> {
    try {
      await setDoc(doc(this.firestore, `Drivers/${uid}/DriverInfo`), driverInfo);
    } catch (e) {
      console.error('Error saving driver info:', e);
      throw new Error('Error saving driver info');
    }
  }


  async createHistory(user: Rider): Promise<void> {
    try {
      const loc: Rider = {
        ...user,
        time: serverTimestamp(),
      };
      const historyId = uuidv4(); // Generate a random ID
      await setDoc(doc(this.firestore, "Drivers", `${this.auth.currentUser.uid}/History/${historyId}`), { ...loc });
  
      await setDoc(doc(this.firestore, `AllRides/${this.auth.currentUser.uid}/customer/${historyId}`), { ...loc });
    } catch (e) {
      console.error('Error creating history:', e);
      throw new Error('Error creating history');
    }
  }

  async getOnlineState(): Promise<boolean> {
    const user = this.auth.currentUser;
    if (user) {
      const userDocRef = doc(this.firestore, 'Drivers', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const data = userDoc.data();
        console.log('Fetched data:', data); // Log the fetched data
        return data.onlineState;
      }
    }
    throw new Error('User not authenticated or document does not exist');
  }
  async goOffline(): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, "Drivers", this.auth.currentUser.uid));
    } catch (e) {
      console.error('Error going offline:', e);
      throw new Error('Error going offline');
    }
  }

  async deleteDriverFromRequest(ID: string): Promise<void> {
    try {
      await deleteDoc(doc(this.firestore, "Request", ID));
    } catch (e) {
      console.error('Error deleting driver from request:', e);
      throw new Error('Error deleting driver from request');
    }
  }

  async updateCountDown(time: number): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, "Request", this.auth.currentUser.uid);
      await updateDoc(userDocRef, {
        countDown: time,
      });
      return true;
    } catch (e) {
      console.error('Error updating countdown:', e);
      return false;
    }
  }

  getMessage() {
    const userDocRef = collection(this.firestore, `Messages/${this.auth.currentUser.uid}/messages`);
    return collectionData(userDocRef);
  }

  getChatMessage(ID) {
    const userDocRef = collection(this.firestore, `Request/${ID}/messages`);
    return collectionData(userDocRef);
  }

  async addChatEnRouteMessage(msg, iD) {
    return await addDoc(collection(this.firestore, `Request/${iD}/messages`), {
      msg: msg,
      from: this.auth.currentUser.uid,
      createdAt: serverTimestamp(),
      myMsg: true,
      fromName: this.profile.Rider_name
    });
  }
  
  async updatChatMessageInfo(id){
    return await setDoc(doc(this.firestore, `Request/${id}/`),
    {
      name: this.profile.Rider_name,
      id: this.profile.Rider_id,
      phone: this.profile.Rider_phone,
      email: this.profile.Rider_email,
      new: true
    }
    )
  }

  async pushDriverToRequest(coord: any, name: string, email: string, phone: any, car: string, cartype: string, plate: string, imageUrl: string, document: string, ID: any): Promise<void> {
    try {
      const loc: Drivers = {
        geohash: geohashForLocation([coord.coords.latitude, coord.coords.longitude]),
        Driver_lat: coord.coords.latitude,
        Driver_lng: coord.coords.longitude,
        Driver_id: this.auth.currentUser.uid,
        Driver_name: name,
        Driver_car: car,
        Driver_imgUrl: imageUrl,
        Driver_rating: 0,
        distance: 0,
        duration: 0,
        seats: 1,
        start: false,
        stop: false,
        intransit: false,
        cancel: false,
        Driver_cartype: cartype,
        Driver_plate: plate,
        Driver_num_rides: 0,
        Document: document,
        Driver_email: email,
        Driver_phone: phone,
        onlineState: false,
        Earnings: 0,
        license: undefined,
        mileage: undefined
      };
      await updateDoc(doc(this.firestore, "Request", ID), { ...loc });
    } catch (e) {
      console.error('Error pushing driver to request:', e);
      throw new Error('Error pushing driver to request');
    }
  }

  async createNewDriver(coord: any, name: string, email: string, phone: any, car: string, cartype: string, plate: string, imageUrl: string, document: string, license: any, mileage: any): Promise<void> {
    try {
      const loc: Drivers = {
        geohash: geohashForLocation([coord.coords.latitude, coord.coords.longitude]),
        Driver_lat: coord.coords.latitude,
        Driver_lng: coord.coords.longitude,
        Driver_id: this.auth.currentUser.uid,
        Driver_name: name,
        Driver_car: car,
        Driver_imgUrl: imageUrl,
        Driver_rating: 0,
        distance: 0,
        duration: 0,
        seats: 1,
        start: false,
        stop: false,
        intransit: false,
        cancel: false,
        Driver_cartype: cartype,
        Driver_plate: plate,
        Driver_num_rides: 0,
        Document: document,
        Driver_email: email,
        Driver_phone: phone,
        onlineState: false,
        Earnings: 0,
        license: license,
        mileage: mileage
      };
      await setDoc(doc(this.firestore, "Drivers", this.auth.currentUser.uid), { ...loc });
    } catch (e) {
      console.error('Error creating new driver:', e);
      throw new Error('Error creating new driver');
    }
  }

  getDriver(): Observable<Drivers[]> {
    return collectionData(this.driverCollection, {
      idField: 'id',
    }) as Observable<Drivers[]>;
  }

  async getUserType(uid: string): Promise<string | null> {
    const userDocRef = doc(this.firestore, `Riders/${uid}`);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return 'rider';
    }
    return null;
  }
  
  updateDriver(driver: Drivers): Promise<void> {
    const driverDocRef = doc(this.firestore, `Drivers/${driver.Driver_id}`);
    return updateDoc(driverDocRef, { ...driver });
  }

  async uploadImage(cameraFile: Photo, uid: string): Promise<string | null> {
    const storageRef = ref(this.storage, `avatars/${uid}`);
    try {
      await uploadString(storageRef, cameraFile.base64String, 'base64');
      const imageUrl = await getDownloadURL(storageRef);
      const userDocRef = doc(this.firestore, `Drivers/${uid}`);
      const docSnapshot = await getDoc(userDocRef);
      if (docSnapshot.exists()) {
      
      await updateDoc(userDocRef, { photoURL: imageUrl });
      }else{
        await setDoc(userDocRef, { photoURL: imageUrl });
        await updateDoc(userDocRef, { photoURL: imageUrl });
      }
      return imageUrl;
    } catch (e) {
      console.error('Error uploading image:', e);
      return null;
    }
  }

  getCards(): Observable<DocumentData[]> {
    const userDocRef = collection(this.firestore, `Drivers/${this.auth.currentUser.uid}/Cards`);
    return collectionData(userDocRef);
  }

  getEarnings(): Observable<DocumentData> {
    const userDocRef = doc(this.firestore, `Drivers/${this.auth.currentUser.uid}`);
    return docData(userDocRef);
  }

  getCartypes(): Observable<DocumentData[]> {
    const cartypesRef = collection(this.firestore, `Cartypes`);
    return collectionData(cartypesRef);
  }

  getRequests(): Observable<DocumentData> {
    const requestsRef = doc(this.firestore, `Request/${this.auth.currentUser.uid}`);
    return docData(requestsRef);
  }

  getDrivers(): Observable<DocumentData[]> {
    const driversRef = collection(this.firestore, `Drivers`);
    return collectionData(driversRef);
  }

  async addChatMessage(msg: string): Promise<void> {
    try {
      await addDoc(collection(this.firestore, `Messages/${this.profile.Driver_id}/messages`), {
        msg,
        from: this.auth.currentUser.uid,
        createdAt: serverTimestamp(),
        myMsg: true,
        fromName: this.profile.Driver_name
      });
    } catch (e) {
      console.error('Error adding chat message:', e);
      throw new Error('Error adding chat message');
    }
  }

  async createCard(name: string, number: any, type: string, id: string): Promise<boolean> {
    try {
      const card: Card = {
        name,
        number,
        type,
        id,
        selected: true
      };
      await setDoc(doc(this.firestore, `Drivers/${this.auth.currentUser.uid}/Cards/${name}`), { ...card });
      return true;
    } catch (e) {
      console.error('Error creating card:', e);
      return false;
    }
  }

  async updateCard(name: string, number: any, type: string, id: string, state: boolean): Promise<boolean> {
    try {
      const card: Card = {
        name,
        number,
        type,
        id,
        selected: state
      };
      await updateDoc(doc(this.firestore, `Drivers/${this.profile.Rider_id}/Cards/${name}`), { ...card });
      return true;
    } catch (e) {
      console.error('Error updating card:', e);
      return false;
    }
  }

  async updateOnlineState(state: boolean): Promise<void> {
    const user = this.auth.currentUser;
    if (user) {
      const userDocRef = doc(this.firestore, 'Drivers', user.uid);
      await setDoc(userDocRef, { onlineState: state }, { merge: true });
    }
  }


  getRiderLocation(riderId: string): Promise<{ lat: number, lng: number } | null> {
    return new Promise((resolve, reject) => {
      const riderDocRef = doc(this.firestore, 'Riders', riderId);
      onSnapshot(riderDocRef, (doc) => {
        const data = doc.data();
        if (data && data.Loc_lat) {
          const riderlocation = {
            lat: data.Loc_lat,
            lng: data.Loc_lng
          };
          resolve(riderlocation);
        } else {
          resolve(null);
        }
      }, (error) => {
        reject(error);
      });
    });
  }


  async updateDriverLocation(coord: { lat: number, lng: number }): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, `Drivers/${this.auth.currentUser.uid}`);
      await updateDoc(userDocRef, {
        geohash: geohashForLocation([coord.lat, coord.lng]),
        Driver_lat: coord.lat,
        Driver_lng: coord.lng,
      });
      return true;
    } catch (e) {
      console.error('Error updating driver location:', e);
      return false;
    }
  }
  
  
  

  async updateEarnings(value: number): Promise<boolean> {
    try {
      const userDocRef = doc(this.firestore, `Drivers/${this.auth.currentUser.uid}`);
      await updateDoc(userDocRef, { Earnings: value });
      return true;
    } catch (e) {
      console.error('Error updating earnings:', e);
      return false;
    }
  }

  ngOnDestroy(): void {
    if (this.authStateSubscription) {
      this.authStateSubscription();
    }
  }
}


