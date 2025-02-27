import { Component, OnInit } from '@angular/core';
import { Auth, updateEmail, updateProfile, User, GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, PhoneAuthProvider, reauthenticateWithCredential, signInWithPhoneNumber } from '@angular/fire/auth';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AvatarService } from 'src/app/services/avatar.service';
import { OverlayService } from 'src/app/services/overlay.service';
import { Geolocation } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { ActionSheetController, AlertController, LoadingController, Platform } from '@ionic/angular';

@Component({
  selector: 'app-details',
  templateUrl: './details.page.html',
  styleUrls: ['./details.page.scss'],
})
export class DetailsPage implements OnInit {

  form: FormGroup;
  imageUrl: string;
  approve: boolean;
  approve2: boolean;
  user: User;
  cartypes: import("@angular/fire/firestore").DocumentData[];
  backButtonSubscription: any;

  constructor(
    private overlay: OverlayService,
    private authy: Auth,
    private avatar: AvatarService,
    private router: Router,
    private actionSheetController: ActionSheetController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private platform: Platform
  ) {
    // Ensure the user is authenticated
    this.authy.onAuthStateChanged((user) => {
      if (user) {
        this.user = user;
        this.avatar.profile = user; // Ensure the profile is set
        console.log(user.uid);
        this.form.patchValue({
          fullname: user.displayName?.split(' ')[0] || '',
          lastname: user.displayName?.split(' ')[1] || '',
          email: user.email || ''
        });
      }
    });

    this.avatar.getCartypes().subscribe((d) => {
      console.log(d);
      this.cartypes = d;
    });
  }

  ngOnInit() {
    this.form = new FormGroup({
      fullname: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(200)]
      }),
      lastname: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(200)]
      }),
      email: new FormControl(null, {
        validators: [Validators.required, Validators.email, Validators.maxLength(200)]
      }),
      plateNumber: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(10)]
      }),
      carType: new FormControl(null, {
        validators: [Validators.required]
      }),
      carName: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(100)]
      }),
      mileage: new FormControl(null, {
        validators: [Validators.required, Validators.min(0)]
      }),
      driverLicense: new FormControl(null, {
        validators: [Validators.required, Validators.minLength(1), Validators.maxLength(20)]
      }),
      driverLicenseImage: new FormControl(null, {
        validators: [Validators.required]
      })
    });
  }

  async changeImage(source: CameraSource) {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: source,
      });
  
      if (image) {
        const loading = await this.loadingController.create();
        await loading.present();
  
        if (!this.avatar.profile?.uid) {
          loading.dismiss();
          const alert = await this.alertController.create({
            header: 'Upload failed',
            message: 'Profile UID is missing.',
            buttons: ['OK'],
          });
          await alert.present();
          return;
        }
  
        try {
          const result = await this.avatar.uploadImage(image, this.avatar.profile.uid);
          loading.dismiss();
  
          if (!result) {
            const alert = await this.alertController.create({
              header: 'Upload failed',
              message: 'There was a problem uploading your avatar.',
              buttons: ['OK'],
            });
            await alert.present();
          } else {
            this.imageUrl = result; // Ensure imageUrl is updated
            const alert = await this.alertController.create({
              header: 'Upload Successful',
              message: 'Your avatar has been successfully uploaded.',
              buttons: ['OK'],
            });
            await alert.present();
          }
        } catch (uploadError) {
          loading.dismiss();
          if (uploadError.message.includes('Photo URL is required and must be less than 1000 characters')) {
            const alert = await this.alertController.create({
              header: 'Upload failed',
              message: 'The image is too big. Please try another image with a smaller size.',
              buttons: ['OK'],
            });
            await alert.present();
          } else {
            const alert = await this.alertController.create({
              header: 'Upload failed',
              message: `There was a problem uploading your avatar: ${uploadError.message}`,
              buttons: ['OK'],
            });
            await alert.present();
          }
        }
      }
    } catch (error) {
      const alert = await this.alertController.create({
        header: 'Upload failed',
        message: `There was a problem uploading your avatar: ${error.message}`,
        buttons: ['OK'],
      });
      await alert.present();
    }
  }
  

  async presentImageSourceActionSheet() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Select Image Source',
      buttons: [
        {
          text: 'Camera',
          icon: 'camera',
          handler: () => {
            this.changeImage(CameraSource.Camera);
          }
        },
        {
          text: 'Gallery',
          icon: 'images',
          handler: () => {
            this.changeImage(CameraSource.Photos);
          }
        },
        {
          text: 'File',
          icon: 'document',
          handler: () => {
            this.selectFile();
          }
        },
        {
          text: 'Cancel',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async selectFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (e: any) => {
          const image = {
            base64String: e.target.result.split(',')[1]
          };

          const result = await this.avatar.uploadImage(image as Photo, this.user.uid);

          if (!result) {
            const alert = await this.alertController.create({
              header: 'Upload failed',
              message: 'There was a problem uploading your avatar.',
              buttons: ['OK'],
            });
            await alert.present();
          } else {
            this.imageUrl = result; // Ensure imageUrl is updated
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  async reauthenticateWithPhoneNumber(): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const user = this.authy.currentUser;
        if (!user) throw new Error('User not authenticated');
  
        console.log('Creating reCAPTCHA container');
        const recaptchaContainerId = 'recaptcha-container';
        let recaptchaContainer = document.getElementById(recaptchaContainerId);
        if (!recaptchaContainer) {
          recaptchaContainer = document.createElement('div');
          recaptchaContainer.id = recaptchaContainerId;
          document.body.appendChild(recaptchaContainer);
        } else {
          recaptchaContainer.innerHTML = ''; // Clear any existing content
        }
  
        console.log('Initializing reCAPTCHA verifier');
        const recaptchaVerifier = new RecaptchaVerifier(recaptchaContainerId, {}, this.authy);
        const phoneNumber = user.phoneNumber;
  
        if (!phoneNumber) {
          throw new Error('User phone number is missing');
        }

        const storedOTP = localStorage.getItem('defaultOTP');
        const userVerificationCode = storedOTP;
        console.log("This is number: " + userVerificationCode)
  
  
        let verificationResult;
        try {
          console.log('Attempting to sign in with phone number');
          verificationResult = await signInWithPhoneNumber(this.authy, phoneNumber, recaptchaVerifier);
          console.log('Verification result:', verificationResult);
        } catch (error) {
          console.error('Error during signInWithPhoneNumber', error);
          this.overlay.showAlert('Error', 'An error occurred during phone number sign-in');
          reject(error);
          return;
        }
  
        if (!verificationResult.verificationId) {
          throw new Error('Verification ID is missing in the verification result');
        }
  
  
        console.log('Prompting user for verification code');
        const alert = await this.alertController.create({
          header: 'Verification',
          inputs: [
            {
              name: 'verificationCode',
              type: 'text',
              placeholder: 'Enter verification code',
              value: userVerificationCode
            }
          ],
          buttons: [
            {
              text: 'Cancel',
              role: 'cancel',
              handler: () => {
                console.log('Verification cancelled');
                reject(new Error('Verification cancelled'));
              }
            },
            {
              text: 'Verify',
              handler: async (data) => {
                const verificationCode = data.verificationCode;
                if (!verificationCode) {
                  reject(new Error('Verification code is required'));
                  return;
                }
                try {
                  console.log('Attempting to verify phone number with verification code');
                  const phoneCredential = PhoneAuthProvider.credential(verificationResult.verificationId, verificationCode);
                  await reauthenticateWithCredential(user, phoneCredential);
                  await this.updateProfile();
                   localStorage.removeItem('defaultOTP');
                  console.log('User re-authenticated with phone number');
                  resolve();
                } catch (error) {
                  console.error('Error verifying phone number', error);
                  reject(error);
                }
              }
            }
          ]
        });
        await alert.present();
  
      } catch (error) {
        console.error('Error during phone re-authentication', error);
        this.overlay.showAlert('Error', error.message || 'An error occurred during phone re-authentication');
        reject(error);
      }
    });
  }
  

  async updateProfile() {
    if (!this.approve2)
    try {
      if (!this.form.valid) {
        this.form.markAllAsTouched();
        return;
      }
      this.approve2 = true;

      const user = this.authy.currentUser;
      if (user) {
        console.log('User authenticated', user);

        if (!this.imageUrl || this.imageUrl.length > 1000) {
          throw new Error('Photo URL is required and must be less than 1000 characters');
        }

        console.log('Updating email...');
        await updateEmail(user, this.form.value.email);
        console.log('Email updated');

        console.log('Updating profile...');
        await updateProfile(user, {
          displayName: `${this.form.value.fullname} ${this.form.value.lastname}`,
          photoURL: this.imageUrl,
        });
        console.log('Profile updated');

        const carInfo = {
          plateNumber: this.form.value.plateNumber,
          carType: this.form.value.carType,
          carName: this.form.value.carName,
          mileage: this.form.value.mileage,
        };

        const driverInfo = {
          driverLicense: this.form.value.driverLicense,
          driverLicenseImage: this.form.value.driverLicenseImage,
        };

        await Geolocation.checkPermissions();
        const coordinates = await Geolocation.getCurrentPosition();
        await this.avatar.createNewDriver(coordinates, this.form.value.fullname + '' + this.form.value.lastname, this.form.value.email, this.authy.currentUser.phoneNumber, carInfo.carName, carInfo.carType, carInfo.plateNumber, this.imageUrl, driverInfo.driverLicenseImage, driverInfo.driverLicense, carInfo.mileage)
        await this.avatar.createCard('Cash', '0', 'cash', 'None')

        this.approve2 = false;
        this.router.navigateByUrl('tabs');
        console.log('Uploaded');
      }
    } catch (e: any) {
      console.error('An error occurred during profile update', e);
      this.approve2 = false;
      if (e.code === 'auth/email-already-in-use') {
        this.overlay.showAlert('Error', 'The email address is already in use by another account.');
      } else if (e.code === 'auth/requires-recent-login') {
        this.reauthenticateWithPhoneNumber();
      } else {
        this.overlay.showAlert('Error', e.message || 'An error occurred');
      }
    }
  }

  async selectDriverLicenseImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (e: any) => {
          const image = {
            base64String: e.target.result.split(',')[1]
          };
          const loading = await this.loadingController.create();
          await loading.present();
          const result = await this.avatar.uploadImage(image as Photo, this.user.uid);
          if (result) {
            loading.dismiss();
            const alert = await this.alertController.create({
              header: 'Upload Complete',
              message: '',
              buttons: ['OK'],
            });
            await alert.present();
            this.form.patchValue({ driverLicenseImage: result });
          } else {
            loading.dismiss();
            const alert = await this.alertController.create({
              header: 'Upload failed',
              message: 'There was a problem uploading your driver license image.',
              buttons: ['OK'],
            });
            await alert.present();
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }


   
  initializeBackButtonCustomHandler() {
    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(10, () => {
      this.handleBackButton();
    });
  }

  async handleBackButton() {
    try {
        await this.showExitConfirmation();
    } catch (error) {
      console.error('Error handling back button:', error);
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

}
