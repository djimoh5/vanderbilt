import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from './service/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('ui');
  protected readonly ready = signal(false);

  constructor(private authService: AuthService) {}

  async ngOnInit() {
    await this.authService.resume();
    this.ready.set(true);
  }
}
