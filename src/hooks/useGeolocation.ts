import { useState, useEffect } from 'react';

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
}

export const useGeolocation = () => {
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    error: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(prev => ({ ...prev, error: 'Geolocation is not supported' }));
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        error: null,
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      setLocation(prev => ({ ...prev, error: error.message }));
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError);

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError);

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return location;
};
