import { Injectable } from '@angular/core'
import { AlertController, ModalController, NavController } from '@ionic/angular'
import { combineLatest, Observable, of } from 'rxjs'
import { concatMap, filter, map, switchMap, take } from 'rxjs/operators'
import { OSWelcomePage } from '../modals/os-welcome/os-welcome.page'
import { ServerModel } from '../models/server-model'
import { exists } from '../util/misc.util'
import { ApiService } from './api/api.service'
import { ConfigService } from './config.service'
import { LoaderService } from './loader.service'
import { OsUpdateService } from './os-update.service'

@Injectable({ providedIn: 'root' })
export class GlobalAlertsNotifier {
  constructor (
    private readonly osUpdateService: OsUpdateService,
    private readonly alertCtrl: AlertController,
    private readonly navCtrl: NavController,
    private readonly loader: LoaderService,
    private readonly config: ConfigService,
    private readonly modalCtrl: ModalController,
    private readonly server: ServerModel,
    private readonly apiService: ApiService,
  ) {
  }

  init () {
    console.log('init')
    of({ }).pipe(
      concatMap(
        () => this.welcomeNeeded$().pipe(
          take(1), // we only show welcome at most once per app instance
          concatMap(vi => vi ? this.presentOsWelcome(vi) : of({ })),
        ),
      ),
      concatMap(
        () => this.osUpdateAlertNeeded$().pipe(
          switchMap(vl => vl ? this.presentUpdateDailogues(vl) : of({ })),
        ),
      ),
    ).subscribe()
  }

  // emits versionInstalled when welcomeAck is false and f.e and b.e have same version
  private welcomeNeeded$ (): Observable<string | undefined> {
    const { welcomeAck, versionInstalled } = this.server.watch()

    return combineLatest([ welcomeAck, versionInstalled ]).pipe(
      filter(([_, vi]) => !!vi),
      map(([wa, vi]) => !wa && vi === this.config.version ? vi : undefined),
    )
  }

  // emits versionLatest whenever autoCheckUpdates becomes true and checkForUpdates yields a new version
  private osUpdateAlertNeeded$ (): Observable<string | undefined> {
    return this.server.watch().autoCheckUpdates.pipe(
      filter(exists), //
      concatMap(() => this.osUpdateService.checkForUpdates$()),
    )
  }

  private async presentUpdateDailogues (vl : string): Promise<any> {
    const { update } = await this.presentAlertNewOS(vl)
    if (update) {
      return this.loader.displayDuringP(
        this.osUpdateService.updateEmbassyOS(vl),
      ).catch(e => alert(e))
    }

    try {
      const newApps = await this.osUpdateService.checkForAppsUpdate()
      if (newApps) {
        return this.presentAlertNewApps()
      }
    } catch (e) {
      console.error(`Exception checking for new apps: `, e)
    }
  }

  private async presentOsWelcome (vi: string): Promise<void> {
    return new Promise(async resolve => {
      const modal = await this.modalCtrl.create({
        backdropDismiss: false,
        component: OSWelcomePage,
        presentingElement: await this.modalCtrl.getTop(),
        componentProps: { version: vi },
      })
      //kick this off async
      this.apiService.acknowledgeOSWelcome(this.config.version).catch(e => {
        console.error(`Unable to acknowledge OS welcome`, e)
      })
      await modal.present()
      modal.onWillDismiss().then(() => resolve())
    })
  }

  private async presentAlertNewApps () {
    const alert = await this.alertCtrl.create({
      backdropDismiss: true,
      header: 'Updates Available!',
      message: 'New service updates are available in the Marketplace.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'View in Marketplace',
          handler: () => {
            return this.navCtrl.navigateForward('/services/marketplace')
          },
        },
      ],
    })

    await alert.present()
  }

  private async presentAlertNewOS (versionLatest: string): Promise<{ cancel?: true, update?: true }> {
    return new Promise(async resolve => {
      const alert = await this.alertCtrl.create({
        backdropDismiss: true,
        header: 'New EmbassyOS Version!',
        message: `Update EmbassyOS to version ${versionLatest}?`,
        buttons: [
          {
            text: 'Not now',
            role: 'cancel',
            handler: () => resolve({ cancel: true }),
          },
          {
            text: 'Update',
            handler: () => resolve({ update: true }),
          },
        ],
      })
      await alert.present()
    })
  }
}