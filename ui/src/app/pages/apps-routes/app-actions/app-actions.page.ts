import { Component } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { ApiService, isRpcFailure, isRpcSuccess } from 'src/app/services/api/api.service'
import { BehaviorSubject } from 'rxjs'
import { AlertController } from '@ionic/angular'
import { ModelPreload } from 'src/app/models/model-preload'
import { LoaderService, markAsLoadingDuring$ } from 'src/app/services/loader.service'
import { ServiceAction, AppInstalledFull } from 'src/app/models/app-types'
import { PropertySubject } from 'src/app/util/property-subject.util'
import { map } from 'rxjs/operators'
import { Cleanup } from 'src/app/util/cleanup'
import { AppStatus } from 'src/app/models/app-model'
import { HttpErrorResponse } from '@angular/common/http'

@Component({
  selector: 'app-actions',
  templateUrl: './app-actions.page.html',
  styleUrls: ['./app-actions.page.scss'],
})
export class AppActionsPage extends Cleanup {
  error = ''
  $loading$ = new BehaviorSubject(true)
  appId: string
  app: PropertySubject<AppInstalledFull>

  constructor(
    private readonly route: ActivatedRoute,
    private readonly apiService: ApiService,
    private readonly alertCtrl: AlertController,
    private readonly preload: ModelPreload,
    private readonly loaderService: LoaderService,
  ) { super() }

  ngOnInit() {
    this.appId = this.route.snapshot.paramMap.get('appId')

    markAsLoadingDuring$(this.$loading$, this.preload.appFull(this.appId)).pipe(
      map(app => this.app = app),
    ).subscribe({ error: e => this.error = e.message })
  }

  async handleAction(action: ServiceAction) {
    if (action.allowedStatuses.includes(this.app.status.getValue())) {
      const alert = await this.alertCtrl.create({
        header: 'Confirm',
        message: `Are you sure you want to execute action "${action.name}"? ${action.warning ? action.warning : ""}`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Execute',
            handler: () => {
              this.executeAction(action)
            },
          },
        ],
      })
      await alert.present()
    } else {
      const statuses = [...action.allowedStatuses]
      const last = statuses.pop()
      let statusesStr = statuses.join(', ')
      let error = null
      if (statuses.length) {
        if (statuses.length > 1) { // oxford comma
          statusesStr += ','
        }
        statusesStr += ` or ${last}`
      } else if (last) {
        statusesStr = `${last}`
      } else {
        error = `There is state for which this action may be run. This is a bug. Please file an issue with the service maintainer.`
      }
      const alert = await this.alertCtrl.create({
        header: 'Forbidden',
        message: error || `Action "${action.name}" can only be executed when service is ${statusesStr}`,
        buttons: ['OK'],
        cssClass: 'alert-error-message',
      })
      await alert.present()
    }
  }

  private async executeAction(action: ServiceAction) {
    try {
      const res = await this.loaderService.displayDuringP(
        this.apiService.serviceAction(this.appId, action),
      )

      if (isRpcFailure(res)) {
        this.presentAlertActionFail(res.error.code, res.error.message)
      }

      if (isRpcSuccess(res)) {
        const successAlert = await this.alertCtrl.create({
          header: 'Execution Complete',
          message: res.result.split('\n').join('</br ></br />'),
          buttons: ['OK'],
          cssClass: 'alert-success-message',
        })
        return await successAlert.present()
      }
    } catch (e) {
      if (e instanceof HttpErrorResponse) {
        this.presentAlertActionFail(e.status, e.message)
      } else {
        this.presentAlertActionFail(-1, e.message || JSON.stringify(e))
      }
    }
  }

  private async presentAlertActionFail(code: number, message: string): Promise<void> {
    const failureAlert = await this.alertCtrl.create({
      header: 'Execution Failed',
      message: `Error code ${code}. ${message}`,
      buttons: ['OK'],
      cssClass: 'alert-error-message',
    })
    return await failureAlert.present()
  }
}
