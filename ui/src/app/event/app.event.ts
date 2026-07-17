import { AppEvent, BaseEvent } from '../../../../event/event.model';

@AppEvent('Event.Alert')
export class AlertEvent extends BaseEvent<{ message: string }> { }

@AppEvent('Event.ToggleSideNav')
export class ToggleSideNavEvent extends BaseEvent<void> { }

@AppEvent('Event.WorkspaceChanged')
export class WorkspaceChangedEvent extends BaseEvent<{ propertyId: string; period: string }> { }