import { Component, signal, ViewChild } from '@angular/core';
import { HeaderBarComponent } from './features/layout/header-bar.component';
import { SplitViewComponent } from './features/layout/split-view.component';
import { MobileToggleComponent } from './features/layout/mobile-toggle.component';
import { ChatPanelComponent } from './features/chat/chat-panel.component';
import { CanvasPanelComponent } from './features/canvas/canvas-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    HeaderBarComponent,
    SplitViewComponent,
    MobileToggleComponent,
    ChatPanelComponent,
    CanvasPanelComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  @ViewChild(SplitViewComponent) splitView?: SplitViewComponent;

  protected readonly title = signal('charts-frontend');

  /**
   * Handle mobile view toggle
   */
  onMobileViewChanged(view: 'chat' | 'canvas'): void {
    this.splitView?.setMobileView(view);
  }
}
