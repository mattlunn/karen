import React from 'react';
import classnames from 'classnames';

const MINUTES_IN_A_DAY = 1440;
const INTERVAL_SIZE_MINS = 5;

interface HeatMapActivity {
  datum: { isHeating: boolean };
}

interface HeatingHeatMapProps {
  activity: HeatMapActivity[];
  withHours?: boolean;
  colorMask: string;
}

export default function HeatingHeatMap({ activity, withHours = true, colorMask }: HeatingHeatMapProps) {
  const hours: React.ReactNode[] = [];

  for (let hour = 1; hour < 24; hour++) {
    hours.push(
      <div
        key={hour}
        className={classnames('heating-heat-map__marker', {
          'heating-heat-map__marker--quarter': hour % 3 === 0
        })}
        style={{
          left: `${(hour * 100) / 24}%`
        }}
      >
        {hour.toString().length === 2 ? hour : `0${hour}`}
      </div>
    );
  }

  return (
    <div className="heating-heat-map">
      <div className="heating-heat-map__map">
        {activity.map(({ datum: { isHeating }}, index) => {
          return (
            <div
              key={index}
              className={classnames('heating-heat-map__segment', { 'heating-heat-map__segment--heating': isHeating })}
              style={{
                width: ((INTERVAL_SIZE_MINS * 100) / MINUTES_IN_A_DAY) + '%',
                backgroundColor: isHeating ? colorMask : ''
              }}
            />
          );
        })}

        <div
          className="heating-heat-map__rest-of-day"
          style={{
            width: ((1 - ((activity.length * INTERVAL_SIZE_MINS) / MINUTES_IN_A_DAY)) * 100) + '%'
          }}
        />
      </div>
      {withHours === false ? '' : <div className="heating-heat-map__markers">{hours}</div>}
    </div>
  );
}
