import React, { useState, useEffect, useCallback } from 'react';

interface WeatherWidgetProps {
  lat: number | null;
  lon: number | null;
  tempUnit: 'F' | 'C';
  onSunsetIso?: (iso: string) => void;
  compact?: boolean;
}

interface WeatherData {
  currentTemp: number;
  currentCode: number;
  dailyMax: number[];
  dailyMin: number[];
  dailyCodes: number[];
  dailyDates: string[];
  sunsetIso: string;
}

const WMO_MAP: { range: [number, number]; emoji: string; label: string }[] = [
  { range: [0, 0], emoji: '☀️', label: 'Clear' },
  { range: [1, 3], emoji: '⛅', label: 'Partly cloudy' },
  { range: [45, 48], emoji: '🌫️', label: 'Fog' },
  { range: [51, 67], emoji: '🌧️', label: 'Rain' },
  { range: [71, 77], emoji: '❄️', label: 'Snow' },
  { range: [80, 82], emoji: '🌦️', label: 'Showers' },
  { range: [95, 99], emoji: '⛈️', label: 'Thunderstorm' },
];

function wmoToDisplay(code: number): { emoji: string; label: string } {
  for (const entry of WMO_MAP) {
    if (code >= entry.range[0] && code <= entry.range[1]) {
      return { emoji: entry.emoji, label: entry.label };
    }
  }
  return { emoji: '🌡️', label: 'Unknown' };
}

function getDayLabel(dateStr: string, index: number): string {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tmrw';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ lat, lon, tempUnit, onSunsetIso, compact = false }) => {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchWeather = useCallback(async () => {
    if (lat === null || lon === null) return;
    setLoading(true);
    setError(false);
    try {
      const tempUnitParam = tempUnit === 'F' ? 'fahrenheit' : 'celsius';
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', lat.toString());
      url.searchParams.set('longitude', lon.toString());
      url.searchParams.set('current', 'temperature_2m,weather_code');
      url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code,sunset');
      url.searchParams.set('timezone', 'auto');
      url.searchParams.set('forecast_days', '4');
      url.searchParams.set('temperature_unit', tempUnitParam);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Weather fetch failed');
      const json = await res.json();

      const weatherData: WeatherData = {
        currentTemp: Math.round(json.current.temperature_2m),
        currentCode: json.current.weather_code,
        dailyMax: json.daily.temperature_2m_max.slice(0, 4).map(Math.round),
        dailyMin: json.daily.temperature_2m_min.slice(0, 4).map(Math.round),
        dailyCodes: json.daily.weather_code.slice(0, 4),
        dailyDates: json.daily.time.slice(0, 4),
        sunsetIso: json.daily.sunset[0],
      };

      setData(weatherData);
      if (onSunsetIso) {
        onSunsetIso(weatherData.sunsetIso);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [lat, lon, tempUnit, onSunsetIso]);

  useEffect(() => {
    fetchWeather();
    const id = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchWeather]);

  if (lat === null || lon === null) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-1.5 text-sm text-slate-400">
        <span>📍</span>
        <span>Set location in Settings</span>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 animate-pulse">
        <span className="h-4 w-24 rounded bg-slate-700" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-xs text-red-400">Weather unavailable</div>
    );
  }

  if (!data) return null;

  const current = wmoToDisplay(data.currentCode);

  // Compact single-line variant for mobile header
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-slate-300">
        <span className="text-base leading-none">{current.emoji}</span>
        <span className="font-medium text-white">{data.currentTemp}°{tempUnit}</span>
        <span className="text-slate-400 text-xs">· {current.label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {/* Current */}
      <div className="flex items-center gap-1.5">
        <span className="text-3xl leading-none">{current.emoji}</span>
        <div className="leading-tight">
          <div className="text-2xl font-light text-white">
            {data.currentTemp}°{tempUnit}
          </div>
          <div className="text-[11px] text-slate-400">{current.label}</div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-10 w-px bg-white/10" />

      {/* 3-day strip (days 1-3, skip today) */}
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => {
          const dayInfo = wmoToDisplay(data.dailyCodes[i]);
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                {getDayLabel(data.dailyDates[i], i)}
              </span>
              <span className="text-base leading-none">{dayInfo.emoji}</span>
              <span className="text-xs text-white font-medium">{data.dailyMax[i]}°</span>
              <span className="text-[10px] text-slate-500">{data.dailyMin[i]}°</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeatherWidget;
