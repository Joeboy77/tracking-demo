import React, { useState, useEffect, useRef } from 'react';
import MapComponent from './MapComponent';

const CourierView = ({ socket, connected }) => {
  const [orderData, setOrderData] = useState({
    orderId: 'order-12345',
    customer: 'John Doe',
    restaurant: 'Pizza Palace',
    customerPhone: '+233 24 123 4567'
  });
  
  const [courierLocation, setCourierLocation] = useState(null);
  const [customerLocation, setCustomerLocation] = useState({
    coordinates: [5.6037, -0.1870],
    address: 'Delivery Location (Set by Customer)'
  });
  const [deliveryStatus, setDeliveryStatus] = useState('picked-up');
  const [isTracking, setIsTracking] = useState(false);
  const [routeSimulation, setRouteSimulation] = useState(false);
  const [distance, setDistance] = useState(null);
  const [isControlsMinimized, setIsControlsMinimized] = useState(false);
  
  const mapRef = useRef(null);
  const gpsControlRef = useRef(null);
  const courierMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const routeRef = useRef(null);
  const simulationIntervalRef = useRef(null);

  const restaurantLocation = [40.7589, -73.9851];

  useEffect(() => {
    if (socket && connected) {
      socket.emit('start-delivery', orderData.orderId);
      
      socket.on('customer-location-update', (data) => {
        console.log('Customer location updated:', data);
        if (data.customerLocation) {
          setCustomerLocation(data.customerLocation);
          setOrderData(prev => ({
            ...prev,
            customerAddress: data.customerLocation.address
          }));
          updateCustomerMarker(data.customerLocation.coordinates);
          
          if (courierLocation) {
            calculateDistance(courierLocation, data.customerLocation.coordinates);
          }
        }
      });

      return () => {
        socket.off('customer-location-update');
      };
    }
  }, [socket, connected, courierLocation]);

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

  const generateRoutePoints = (start, end, numPoints) => {
    const points = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const ratio = i / numPoints;
      let lat = start[0] + (end[0] - start[0]) * ratio;
      let lng = start[1] + (end[1] - start[1]) * ratio;
      
      if (i > 0 && i < numPoints) {
        const variation = 0.002;
        const curveFactor = Math.sin(ratio * Math.PI) * 0.001;
        lat += (Math.random() - 0.5) * variation + curveFactor;
        lng += (Math.random() - 0.5) * variation + curveFactor;
      }
      
      points.push([lat, lng]);
    }
    
    return points;
  };

  useEffect(() => {
    if (routeSimulation && socket && connected && customerLocation) {
      const routePoints = generateRoutePoints(
        restaurantLocation, 
        customerLocation.coordinates, 
        25
      );
      
      let currentIndex = 0;
      const totalPoints = routePoints.length;
      
      const moveAlongRoute = () => {
        if (currentIndex < totalPoints && routeSimulation) {
          const newLocation = {
            lat: routePoints[currentIndex][0],
            lng: routePoints[currentIndex][1]
          };

          setCourierLocation(newLocation);
          updateCourierMarker(newLocation);
          calculateDistance(newLocation, customerLocation.coordinates);

          const progress = currentIndex / totalPoints;
          let status = 'on-the-way';
          if (progress < 0.1) status = 'picked-up';
          else if (progress > 0.9) status = 'delivered';

          socket.emit('courier-location-update', {
            orderId: orderData.orderId,
            location: newLocation,
            status: status
          });

          currentIndex++;
          
          if (currentIndex < totalPoints) {
            simulationIntervalRef.current = setTimeout(moveAlongRoute, 1500);
          } else {
            setDeliveryStatus('delivered');
            setRouteSimulation(false);
          }
        }
      };

      moveAlongRoute();
      
      return () => {
        if (simulationIntervalRef.current) {
          clearTimeout(simulationIntervalRef.current);
        }
      };
    }
  }, [routeSimulation, socket, connected, customerLocation]);

  const handleMapReady = (map) => {
    mapRef.current = map;
    
    if (window.L && window.L.Control && window.L.Control.Gps) {
      const gpsControl = new window.L.Control.Gps({
        autoActive: false,
        autoCenter: true,
        autoFollow: true,
        position: 'topright',
        style: {
          radius: 10,
          weight: 3,
          color: '#007bff',
          fillColor: '#007bff',
          fillOpacity: 0.8
        }
      });

      gpsControl.addTo(map);
      gpsControlRef.current = gpsControl;
      
      gpsControl.on('gps:located', (e) => {
        const newLocation = {
          lat: e.latlng.lat,
          lng: e.latlng.lng
        };
        
        setCourierLocation(newLocation);
        calculateDistance(newLocation, customerLocation.coordinates);
        
        if (socket && connected && isTracking) {
          socket.emit('courier-location-update', {
            orderId: orderData.orderId,
            location: newLocation,
            status: deliveryStatus
          });
        }
      });
    }

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

    window.L.marker(restaurantLocation, { icon: restaurantIcon })
      .addTo(map)
      .bindPopup(`<b>${orderData.restaurant}</b><br>Pickup Location`);

    updateCustomerMarker(customerLocation.coordinates);
    updateRouteLine();
  };

  const updateCustomerMarker = (location) => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    if (customerMarkerRef.current) {
      map.removeLayer(customerMarkerRef.current);
    }

    const customerIcon = window.L.divIcon({
      className: 'customer-marker',
      html: '<i class="fas fa-map-marker-alt" style="color: white; font-size: 16px; margin-top: 6px;"></i>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    customerMarkerRef.current = window.L.marker(location, { icon: customerIcon })
      .addTo(map)
      .bindPopup(`<b>${orderData.customer}</b><br>${customerLocation.address}`);

    updateRouteLine();
    fitMapToBounds();
  };

  const updateRouteLine = () => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    if (routeRef.current) {
      map.removeLayer(routeRef.current);
    }

    const routeLine = window.L.polyline([restaurantLocation, customerLocation.coordinates], {
      color: '#007bff',
      weight: 4,
      opacity: 0.7,
      dashArray: '10, 10'
    }).addTo(map);

    routeRef.current = routeLine;
  };

  const updateCourierMarker = (location) => {
    if (!mapRef.current || !location) return;

    const map = mapRef.current;

    if (courierMarkerRef.current) {
      map.removeLayer(courierMarkerRef.current);
    }

    const courierIcon = window.L.divIcon({
      className: 'courier-marker',
      html: '<i class="fas fa-motorcycle" style="color: white; font-size: 14px; margin-top: 8px;"></i>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    courierMarkerRef.current = window.L.marker([location.lat, location.lng], { icon: courierIcon })
      .addTo(map)
      .bindPopup('<b>Your Location</b><br>Courier Position');

    if (routeRef.current) {
      map.removeLayer(routeRef.current);
    }

    routeRef.current = window.L.polyline([
      [location.lat, location.lng],
      customerLocation.coordinates
    ], {
      color: '#28a745',
      weight: 4,
      opacity: 0.8
    }).addTo(map);
  };

  const fitMapToBounds = () => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const markers = [restaurantLocation, customerLocation.coordinates];
    
    if (courierLocation) {
      markers.push([courierLocation.lat, courierLocation.lng]);
    }

    const group = new window.L.featureGroup(
      markers.map(coord => window.L.marker(coord))
    );
    map.fitBounds(group.getBounds().pad(0.1));
  };

  const startTracking = () => {
    setIsTracking(true);
    if (gpsControlRef.current) {
      gpsControlRef.current.activate();
    }
  };

  const stopTracking = () => {
    setIsTracking(false);
    if (gpsControlRef.current) {
      gpsControlRef.current.deactivate();
    }
  };

  const startRouteSimulation = () => {
    setRouteSimulation(true);
    setDeliveryStatus('on-the-way');
  };

  const stopRouteSimulation = () => {
    setRouteSimulation(false);
    if (simulationIntervalRef.current) {
      clearTimeout(simulationIntervalRef.current);
    }
  };

  const markAsDelivered = () => {
    setDeliveryStatus('delivered');
    stopRouteSimulation();
    
    if (socket && connected) {
      socket.emit('courier-location-update', {
        orderId: orderData.orderId,
        location: courierLocation || { 
          lat: customerLocation.coordinates[0], 
          lng: customerLocation.coordinates[1] 
        },
        status: 'delivered'
      });
    }
  };

  const calculateETA = () => {
    if (!distance) return 'Calculating...';
    
    const speedKmh = 25;
    const timeHours = distance / speedKmh;
    const timeMinutes = Math.round(timeHours * 60);
    
    return timeMinutes < 60 ? `${timeMinutes} min` : `${Math.round(timeHours * 10) / 10}h`;
  };

  return (
    <div className="view-container full-map courier-view">
      {/* Full Screen Map */}
      <div className="map-container full-screen">
        <MapComponent 
          center={customerLocation.coordinates}
          zoom={12}
          onMapReady={handleMapReady}
        />
      </div>

      {/* Compact Top Bar */}
      <div className="top-bar courier-top">
        <div className="courier-summary">
          <span className="delivery-badge">🛵 Delivery #{orderData.orderId.slice(-6)}</span>
          <span className="customer-name">{orderData.customer}</span>
          <span className={`status-indicator ${deliveryStatus}`}>
            {deliveryStatus.replace('-', ' ')}
          </span>
        </div>
        
        <div className="quick-actions">
          <button 
            className="action-btn minimize-btn"
            onClick={() => setIsControlsMinimized(!isControlsMinimized)}
          >
            <i className={`fas ${isControlsMinimized ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
          </button>
        </div>
      </div>

      {/* Delivery Info Panel */}
      {!isControlsMinimized && (
        <div className="courier-info-drawer">
          <div className="delivery-details">
            <div className="detail-item">
              <span className="label">Customer:</span>
              <span className="value">{orderData.customer}</span>
            </div>
            <div className="detail-item">
              <span className="label">Phone:</span>
              <span className="value">{orderData.customerPhone}</span>
            </div>
            <div className="detail-item">
              <span className="label">Delivery To:</span>
              <span className="value">{customerLocation.address}</span>
            </div>
            {distance && (
              <>
                <div className="detail-item">
                  <span className="label">Distance:</span>
                  <span className="value">{distance.toFixed(1)} km</span>
                </div>
                <div className="detail-item">
                  <span className="label">ETA:</span>
                  <span className="value">{calculateETA()}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating Control Panel */}
      <div className="floating-controls">
        <h4>
          <i className="fas fa-cogs"></i> Controls
        </h4>
        
        <div className="control-buttons">
          {!isTracking ? (
            <button 
              className="control-btn primary compact" 
              onClick={startTracking}
              disabled={!connected}
            >
              <i className="fas fa-play"></i>
              Start GPS
            </button>
          ) : (
            <button 
              className="control-btn danger compact" 
              onClick={stopTracking}
            >
              <i className="fas fa-stop"></i>
              Stop GPS
            </button>
          )}

          {!routeSimulation && deliveryStatus !== 'delivered' && (
            <button 
              className="control-btn primary compact" 
              onClick={startRouteSimulation}
              disabled={!connected}
            >
              <i className="fas fa-route"></i>
              Simulate
            </button>
          )}

          {routeSimulation && (
            <button 
              className="control-btn danger compact" 
              onClick={stopRouteSimulation}
            >
              <i className="fas fa-stop"></i>
              Stop Sim
            </button>
          )}

          {deliveryStatus !== 'delivered' && (
            <button 
              className="control-btn success compact" 
              onClick={markAsDelivered}
              disabled={!connected}
            >
              <i className="fas fa-check"></i>
              Delivered
            </button>
          )}
        </div>

        <div className="tracking-status">
          <i className={`fas ${isTracking ? 'fa-satellite' : routeSimulation ? 'fa-route' : 'fa-pause'}`}></i>
          <span>
            {isTracking ? 'Live GPS' : 
             routeSimulation ? 'Simulating' : 
             'Inactive'}
          </span>
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="bottom-stats">
        <div className="stat-item">
          <div className="stat-value">
            {distance ? `${distance.toFixed(1)} km` : '---'}
          </div>
          <div className="stat-label">Distance</div>
        </div>
        
        <div className="stat-item">
          <div className="stat-value">
            {calculateETA()}
          </div>
          <div className="stat-label">ETA</div>
        </div>
        
        <div className="stat-item">
          <div className="stat-value">
            {connected ? 'Online' : 'Offline'}
          </div>
          <div className="stat-label">Status</div>
        </div>
      </div>

      {/* Accra Delivery Badge */}
      <div className="accra-badge courier-badge">
        📍 Accra Delivery
      </div>
    </div>
  );
};

export default CourierView;