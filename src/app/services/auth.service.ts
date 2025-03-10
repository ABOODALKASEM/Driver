import { Injectable } from '@angular/core';
import {
  Auth,
  signOut,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signInWithCustomToken,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  getAuth,
  linkWithCredential,
  unlink,
  fetchSignInMethodsForEmail,
  updateProfile,
} from '@angular/fire/auth';
import { User } from '@angular/fire/auth';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  appVerifier: any;
  confirmationResult: any;
  user$: Observable<User | null>;

  constructor(private auth: Auth) {
    this.user$ = new Observable<User | null>((subscriber) => {
      this.auth.onAuthStateChanged(subscriber);
    });
  }

  recaptcha() {
    this.appVerifier = new RecaptchaVerifier('sign-in-button', {
      size: 'invisible',
      callback: (response) => {
        console.log(response);
      },
      'expired-callback': () => {}
    }, this.auth);
  }

  async signInWithPhoneNumber(phoneNumber: string) {
    try {
      if (!this.appVerifier) this.recaptcha();
      const confirmationResult = await signInWithPhoneNumber(this.auth, phoneNumber, this.appVerifier);
      this.confirmationResult = confirmationResult;
      return confirmationResult;
    } catch (e) {
      throw(e);
    }
  }

  async updateProfile(displayName: string, photoURL: string): Promise<void> {
    if (this.auth.currentUser) {
      try {
        await updateProfile(this.auth.currentUser, { displayName, photoURL });
      } catch (error) {
        console.error('Error updating profile: ', error);
      }
    } else {
      throw new Error('No user is currently signed in.');
    }
  }

  get currentUser() {
    return this.auth.currentUser;
  }

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    const auth = getAuth();
    return signInWithPopup(auth, provider);
  }

  async linkGoogleAccount(user: User) {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(this.auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential) {
        await linkWithCredential(user, credential);
      }
    } catch (error) {
      if (error.code === 'auth/credential-already-in-use') {
        console.error('Error during Google sign-in: ', error);

        if (error.customData && error.customData.email) {
          const existingSignInMethods = await fetchSignInMethodsForEmail(this.auth, error.customData.email);
          if (existingSignInMethods.includes(GoogleAuthProvider.PROVIDER_ID)) {
            await unlink(this.auth.currentUser, GoogleAuthProvider.PROVIDER_ID);
            const result = await signInWithPopup(this.auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential) {
              await linkWithCredential(user, credential);
            }
          }
        } else {
          console.error('Missing email in error details: ', error);
        }
      } else {
        throw error;
      }
    }
  }

  async verifyOtp(otp: string) {
    try {
      if (!this.appVerifier) this.recaptcha();
      const result = await this.confirmationResult.confirm(otp);
      console.log(result);
      const user = result?.user;
      console.log(user);
    } catch (e) {
      throw(e?.message);
    }
  }

  logout() {
    return signOut(this.auth);
  }
}
