import AutoSolve from './autoSolve';

export default class Settings {
  discordWebhookURL: string;

  autoSolve: AutoSolve;

  constructor({ autoSolve, discordWebhookURL }: Settings) {
    this.autoSolve = autoSolve;
    this.discordWebhookURL = discordWebhookURL;
  }
}
