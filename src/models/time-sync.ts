import {ERRORS} from '../util/errors';

import {STRINGS} from '../config';

import {ModelParams, ModelPluginInterface} from '../types/model-interface';
import {TimeNormalizerConfig} from '../types/time-sync';

const {InputValidationError} = ERRORS;

const {INVALID_TIME_NORMALIZATION, INVALID_TIME_INTERVAL} = STRINGS;

export class TimeSyncModel implements ModelPluginInterface {
  startTime: string | undefined;
  endTime: string | undefined;
  interval = 1;

  /**
   * Setups basic configuration.
   */
  async configure(params: TimeNormalizerConfig): Promise<ModelPluginInterface> {
    this.startTime = params['start-time'];
    this.endTime = params['end-time'];
    this.interval = params.interval;

    return this;
  }

  /**
   * Calculates minimal factor.
   */
  private convertPerInterval = (
    value: number,
    duration: number,
    interval: number
  ) => (value / duration) * interval;

  /**
   * Normalizes provided time window according to time configuration.
   */
  async execute(inputs: ModelParams[]): Promise<ModelParams[]> {
    const {startTime, endTime, interval} = this;

    if (!startTime || !endTime) {
      throw new InputValidationError(INVALID_TIME_NORMALIZATION);
    }

    if (!interval) {
      throw new InputValidationError(INVALID_TIME_INTERVAL);
    }

    const newInputs = inputs.reduce((acc, input) => {
      const {energy, duration} = input;
      input.carbon = input['operational-carbon'] + input['embodied-carbon']; // @todo: this should be handled in appropriate layer

      const energyPerSecond = this.convertPerInterval(
        energy,
        duration,
        interval
      );
      const carbonPerSecond = this.convertPerInterval(
        input.carbon,
        duration,
        interval
      );

      const unixStartTime = Math.floor(new Date(startTime).getTime() / 1000);
      const unixEndTime = Math.floor(new Date(endTime).getTime() / 1000);

      for (let i = unixStartTime; i < unixEndTime; i++) {
        acc.push({
          timestamp: new Date(i * 1000).toISOString(),
          carbon: carbonPerSecond,
          energy: energyPerSecond,
          'operational-carbon': 30,
          'embodied-carbon': 30,
          duration: interval,
        });
      }

      return acc;
    }, [] as ModelParams[]);

    const unixStartTime = Math.floor(new Date(startTime).getTime() / 1000);
    const unixEndTime = Math.floor(new Date(endTime).getTime() / 1000);

    for (let i = unixStartTime; i < unixEndTime; i += interval) {
      const timestamp = i.toString();

      if (!newInputs.some(input => input.timestamp === timestamp)) {
        newInputs.push({timestamp, energy: 0, carbon: 0, duration: interval});
      }
    }

    return newInputs;
  }
}
