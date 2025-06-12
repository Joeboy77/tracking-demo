import React, { useState, useEffect, useRef } from 'react';
import MapComponent from './MapComponent';
import LocationInput from './LocationInput';

const CustomerView = ({ socket, connected }) => {
  const [orderData, setOrderData] = useState({
    orderId: 'order-12345',
    status: 'preparing',
    restaurant: 'Pizza Palace',
    estimatedTime: '25-30 min'
  });
  
  const [courierLocation, setCourierLocation] = useState(null);
  const [customerLocation, setCustomerLocation] = useState({
    coordinates: [5.6037, -0.1870], // Default Accra
    address: 'Accra, Ghana'
  });
  const [deliveryProgress, setDeliveryProgress] = useState('preparing');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [distance, setDistance] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const mapRef = useRef(null);
  const courierMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const restaurantMarkerRef = useRef(null);
  const routeLineRef = useRef(null);

  // Sample restaurant location
  const restaurantLocation = [40.7589, -73.9851]; // Times Square area

  useEffect(() => {
    if (socket && connected) {
      socket.emit('track-order', orderData.orderId);
      
      socket.emit('customer-location-update', {
        orderId: orderData.orderId,
        customerLocation: customerLocation
      });
      
      socket.on('courier-location-update', (data) => {
        console.log('Courier location update:', data);
        setCourierLocation(data.location);
        setDeliveryProgress(data.status);
        updateCourierMarker(data.location);
        calculateDistance(data.location, customerLocation.coordinates);
      });

      return () => {
        socket.off('courier-location-update');
      };
    }
  }, [socket, connected, customerLocation]);

  const calculateDistance = (point1, point2) => {
    if (!point1 || !point2) return null;
    
    const R = 6371;
    const dLat = (point2[0] - point1.lat) * Math.PI / 180;
    const dLon = (point2[1] - point1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = R * c;
    
    setDistance(distanceKm);
    return distanceKm;
  };

  const handleLocationSet = (newLocation) => {
    setCustomerLocation(newLocation);
    updateCustomerMarker(newLocation.coordinates);
    setShowLocationInput(false);
    
    setOrderData(prev => ({
      ...prev,
      customerAddress: newLocation.address
    }));

    if (socket && connected) {
      socket.emit('customer-location-update', {
        orderId: orderData.orderId,
        customerLocation: newLocation
      });
    }

    if (courierLocation) {
      calculateDistance(courierLocation, newLocation.coordinates);
    }
  };

  const handleMapReady = (map) => {
    mapRef.current = map;
    
    if (window.L && window.L.Control && window.L.Control.Gps) {
      const gpsControl = new window.L.Control.Gps({
        autoActive: false,
        autoCenter: false,
        position: 'topright',
        style: {
          radius: 8,
          weight: 2,
          color: '#28a745',
          fillColor: '#28a745',
          fillOpacity: 0.7
        }
      });

      gpsControl.addTo(map);
      
      gpsControl.on('gps:located', (e) => {
        const newLocation = {
          coordinates: [e.latlng.lat, e.latlng.lng],
          address: `GPS Location: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`
        };
        handleLocationSet(newLocation);
      });
    }

    map.on('click', (e) => {
      if (showLocationInput) {
        const newLocation = {
          coordinates: [e.latlng.lat, e.latlng.lng],
          address: `Map Location: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`
        };
        handleLocationSet(newLocation);
      }
    });

    addInitialMarkers();
  };

  const addInitialMarkers = () => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    const restaurantIcon = window.L.divIcon({
      className: 'restaurant-marker',
      html: '<i class="fas fa-utensils" style="color: white; font-size: 16px; margin-top: 8px;"></i>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    restaurantMarkerRef.current = window.L.marker(restaurantLocation, { icon: restaurantIcon })
      .addTo(map)
      .bindPopup(`<b>${orderData.restaurant}</b><br>Restaurant Location`);

    updateCustomerMarker(customerLocation.coordinates);
  };

  const updateCustomerMarker = (location) => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    if (customerMarkerRef.current) {
      map.removeLayer(customerMarkerRef.current);
    }

    const customerIcon = window.L.divIcon({
      className: 'customer-marker',
      html: '<i class="fas fa-user" style="color: white; font-size: 14px; margin-top: 8px;"></i>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    customerMarkerRef.current = window.L.marker(location, { icon: customerIcon })
      .addTo(map)
      .bindPopup(`<b>Delivery Location</b><br>${customerLocation.address}`);
    
    map.setView(location, 13);
  };

  const updateCourierMarker = (location) => {
    if (!mapRef.current || !location) return;

    const map = mapRef.current;

    if (courierMarkerRef.current) {
      map.removeLayer(courierMarkerRef.current);
    }

    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
    }

    const courierIcon = window.L.divIcon({
      className: 'courier-marker',
      html: '<i class="fas fa-motorcycle" style="color: white; font-size: 14px; margin-top: 8px;"></i>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    courierMarkerRef.current = window.L.marker([location.lat, location.lng], { icon: courierIcon })
      .addTo(map)
      .bindPopup('<b>Courier Location</b><br>Your delivery is on the way!');

    routeLineRef.current = window.L.polyline([
      [location.lat, location.lng],
      customerLocation.coordinates
    ], {
      color: '#007bff',
      weight: 3,
      opacity: 0.7,
      dashArray: '5, 10'
    }).addTo(map);

    const group = new window.L.featureGroup([
      window.L.marker([location.lat, location.lng]),
      window.L.marker(customerLocation.coordinates)
    ]);
    map.fitBounds(group.getBounds().pad(0.1));
  };

  const calculateETA = () => {
    if (!distance) return '25-30 min';
    
    const speedKmh = 30;
    const timeHours = distance / speedKmh;
    const timeMinutes = Math.round(timeHours * 60);
    
    return timeMinutes < 60 ? `${timeMinutes} min` : `${Math.round(timeHours * 10) / 10}h`;
  };

  const getProgressSteps = () => {
    const steps = [
      { key: 'preparing', label: 'Preparing', icon: 'fas fa-fire' },
      { key: 'picked-up', label: 'Picked Up', icon: 'fas fa-box' },
      { key: 'on-the-way', label: 'On the Way', icon: 'fas fa-route' },
      { key: 'delivered', label: 'Delivered', icon: 'fas fa-check' }
    ];

    const currentIndex = steps.findIndex(step => step.key === deliveryProgress);
    
    return steps.map((step, index) => ({
      ...step,
      status: index < currentIndex ? 'completed' : 
              index === currentIndex ? 'current' : 'pending'
    }));
  };

  return (
    <div className="view-container full-map">
      {/* Full Screen Map */}
      <div className="map-container full-screen">
        <MapComponent 
          center={customerLocation.coordinates}
          zoom={13}
          onMapReady={handleMapReady}
        />
      </div>

      {/* Compact Top Bar */}
      <div className="top-bar">
        <div className="order-summary">
          <span className="order-id">#{orderData.orderId.slice(-6)}</span>
          <span className="restaurant">{orderData.restaurant}</span>
          <span className={`status-indicator ${deliveryProgress}`}>
            {deliveryProgress.replace('-', ' ')}
          </span>
        </div>
        
        <div className="quick-actions">
          <button 
            className="action-btn location-btn"
            onClick={() => setShowLocationInput(!showLocationInput)}
          >
            <i className="fas fa-map-marker-alt"></i>
          </button>
          <button 
            className="action-btn minimize-btn"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <i className={`fas ${isMinimized ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
          </button>
        </div>
      </div>

      {/* Collapsible Info Panel */}
      {!isMinimized && (
        <div className="info-drawer">
          <div className="delivery-details">
            <div className="detail-item">
              <span className="label">Delivery To:</span>
              <span className="value">{customerLocation.address}</span>
            </div>
            {distance && (
              <div className="detail-item">
                <span className="label">Distance:</span>
                <span className="value">{distance.toFixed(1)} km</span>
              </div>
            )}
            <div className="detail-item">
              <span className="label">ETA:</span>
              <span className="value">{calculateETA()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Location Input Modal */}
      {showLocationInput && (
        <div className="location-modal">
          <div className="modal-backdrop" onClick={() => setShowLocationInput(false)}></div>
          <div className="modal-content">
            <LocationInput 
              onLocationSet={handleLocationSet}
              currentLocation={customerLocation}
              userType="customer"
            />
            <button 
              className="close-modal"
              onClick={() => setShowLocationInput(false)}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* Live Tracking Indicator */}
      {courierLocation && (
        <div className="live-tracking-indicator">
          <div className="tracking-pulse"></div>
          <span>Live Tracking</span>
          <div className="distance-info">
            {distance ? `${distance.toFixed(1)} km` : 'Calculating...'}
          </div>
        </div>
      )}

      {/* Bottom Progress Bar */}
      <div className="bottom-progress">
        <div className="progress-container">
          {getProgressSteps().map((step, index) => (
            <div key={step.key} className={`progress-step-compact ${step.status}`}>
              <div className={`step-icon ${step.status}`}>
                <i className={step.icon}></i>
              </div>
              <span className="step-label">{step.label}</span>
            </div>
          ))}
        </div>
        
        <div className="eta-summary">
          <div className="eta-time">{calculateETA()}</div>
          <div className="eta-label">
            {distance ? `${distance.toFixed(1)} km delivery` : 'Estimated Time'}
          </div>
        </div>
      </div>

      {/* Accra Delivery Badge */}
      <div className="accra-badge">
        📍 Accra Only
      </div>
    </div>
  );
};

export default CustomerView;