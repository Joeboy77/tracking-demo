import React, { useEffect, useRef } from 'react';

const MapComponent = ({ 
  center = [40.7128, -74.0060], // Default to NYC
  zoom = 13, 
  onMapReady,
  className = "map-container"
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Check if Leaflet is available
    if (!window.L) {
      console.error('Leaflet is not loaded. Please check your index.html includes Leaflet scripts.');
      return;
    }

    // Create map instance
    const map = window.L.map(mapRef.current).setView(center, zoom);

    // Add OpenStreetMap tiles (same as your GitHub repo)
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    // Call parent callback with map instance
    if (onMapReady) {
      onMapReady(map);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map center when prop changes
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center, zoom]);

  // Show loading message if Leaflet isn't available
  if (!window.L) {
    return (
      <div 
        className={className}
        style={{ 
          height: '100%', 
          width: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#f8f9fa',
          color: '#666'
        }}
      >
        <div>
          <h3>Loading Map...</h3>
          <p>Please wait while Leaflet loads</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={mapRef} 
      className={className}
      style={{ height: '100%', width: '100%' }}
    />
  );
};

export default MapComponent;