import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppAnalyticsEvents, TelemetryEvents } from 'src/constants';
import { GetAppSettingsResponse } from 'src/dto/settings.dto';
import { SettingsAnalyticsService } from './settings-analytics.service';

describe('SettingsAnalyticsService', () => {
  let service: SettingsAnalyticsService;
  let eventEmitter: EventEmitter2;
  let sendEventMethod;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventEmitter2,
        SettingsAnalyticsService,
      ],
    }).compile();

    service = await module.get<SettingsAnalyticsService>(SettingsAnalyticsService);
    eventEmitter = await module.get<EventEmitter2>(EventEmitter2);
    eventEmitter.emit = jest.fn();
    sendEventMethod = jest.spyOn<SettingsAnalyticsService, any>(
      service,
      'sendEvent',
    );
  });

  describe('sendAnalyticsAgreementChange', () => {
    it('should emit ANALYTICS_PERMISSION with state enabled on first app launch', async () => {
      await service.sendAnalyticsAgreementChange(
        new Map([['analytics', true]]),
        undefined,
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(AppAnalyticsEvents.Track, {
        event: TelemetryEvents.AnalyticsPermission,
        eventData: { state: 'enabled' },
        nonTracking: true,
      });
    });
    it('should emit ANALYTICS_PERMISSION with state disabled on first app launch', async () => {
      await service.sendAnalyticsAgreementChange(
        new Map([['analytics', false]]),
        undefined,
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(AppAnalyticsEvents.Track, {
        event: TelemetryEvents.AnalyticsPermission,
        eventData: { state: 'disabled' },
        nonTracking: true,
      });
    });
    it('should not emit ANALYTICS_PERMISSION if agreement did not changed', async () => {
      await service.sendAnalyticsAgreementChange(
        new Map([['analytics', false]]),
        new Map([['analytics', false]]),
      );

      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        AppAnalyticsEvents.Track,
        {
          event: TelemetryEvents.AnalyticsPermission,
          eventData: expect.anything(),
          nonTracking: true,
        },
      );
    });
    it('should emit [ANALYTICS_PERMISSION] if agreement changed', async () => {
      await service.sendAnalyticsAgreementChange(
        new Map([['analytics', false]]),
        new Map([['analytics', true]]),
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(AppAnalyticsEvents.Track, {
        event: TelemetryEvents.AnalyticsPermission,
        eventData: { state: 'disabled' },
        nonTracking: true,
      });
    });
  });

  describe('sendSettingsUpdatedEvent', () => {
    const defaultSettings: GetAppSettingsResponse = {
      agreements: null,
      scanThreshold: 10000,
      theme: null,
    };
    it('should emit [SETTINGS_KEYS_TO_SCAN_CHANGED] event', async () => {
      await service.sendSettingsUpdatedEvent(
        { ...defaultSettings, scanThreshold: 100000 },
        { ...defaultSettings, scanThreshold: 10000 },
      );

      expect(sendEventMethod).toHaveBeenCalledWith(
        TelemetryEvents.SettingsScanThresholdChanged,
        {
          currentValue: 100000,
          currentValueRange: '50 001 - 100 000',
          previousValue: 10000,
          previousValueRange: '5 001 - 10 000',
        },
      );
    });
    it('should not emit [SETTINGS_KEYS_TO_SCAN_CHANGED] for the same value', async () => {
      await service.sendSettingsUpdatedEvent(
        { ...defaultSettings, scanThreshold: 10000 },
        { ...defaultSettings, scanThreshold: 10000 },
      );

      expect(sendEventMethod).not.toHaveBeenCalled();
    });
    it('should not emit event on error', async () => {
      await service.sendSettingsUpdatedEvent(
        { ...defaultSettings, scanThreshold: 10000 },
        undefined,
      );

      expect(sendEventMethod).not.toHaveBeenCalled();
    });
  });
});
