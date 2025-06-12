import React, { useState } from 'react';

const LocationInput = ({ onLocationSet, currentLocation, userType }) => {
  const [addressInput, setAddressInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [manualCoords, setManualCoords] = useState({ lat: '', lng: '' });
  const [inputMethod, setInputMethod] = useState('address');

  // Define Accra boundaries (approximate)
  const ACCRA_BOUNDS = {
    north: 5.8000,   // Northern limit
    south: 5.3000,   // Southern limit  
    east: 0.1000,    // Eastern limit
    west: -0.4000    // Western limit
  };

  // Check if coordinates are within Accra
  const isWithinAccra = (lat, lng) => {
    return (
      lat >= ACCRA_BOUNDS.south &&
      lat <= ACCRA_BOUNDS.north &&
      lng >= ACCRA_BOUNDS.west &&
      lng <= ACCRA_BOUNDS.east
    );
  };

  // Enhanced geocoding with Accra filter
  const geocodeAddress = async (address) => {
    setIsGeocoding(true);
    try {
      // Add "Accra, Ghana" if not already included
      let searchAddress = address;
      if (!address.toLowerCase().includes('accra')) {
        searchAddress = `${address}, Accra, Ghana`;
      } else if (!address.toLowerCase().includes('ghana')) {
        searchAddress = `${address}, Ghana`;
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=5&bounded=1&viewbox=${ACCRA_BOUNDS.west},${ACCRA_BOUNDS.north},${ACCRA_BOUNDS.east},${ACCRA_BOUNDS.south}`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        // Find the first result within Accra bounds
        const accraResult = data.find(result => {
          const lat = parseFloat(result.lat);
          const lon = parseFloat(result.lon);
          return isWithinAccra(lat, lon);
        });

        if (accraResult) {
          const { lat, lon, display_name } = accraResult;
          const location = {
            coordinates: [parseFloat(lat), parseFloat(lon)],
            address: display_name
          };
          onLocationSet(location);
          setAddressInput('');
          return true;
        } else {
          alert('⚠️ Sorry, we only deliver within Accra, Ghana. Please enter a location within Accra.');
          return false;
        }
      } else {
        alert('🔍 Location not found in Accra. Please try a different address within Accra, Ghana.');
        return false;
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('❌ Error finding address. Please try again.');
      return false;
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleAddressSubmit = async (e) => {
    e.preventDefault();
    if (!addressInput.trim()) return;
    
    const success = await geocodeAddress(addressInput.trim());
    if (success) {
      setAddressInput('');
    }
  };

  const handleCoordinatesSubmit = (e) => {
    e.preventDefault();
    const lat = parseFloat(manualCoords.lat);
    const lng = parseFloat(manualCoords.lng);
    
    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid coordinates');
      return;
    }
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Please enter valid latitude (-90 to 90) and longitude (-180 to 180)');
      return;
    }

    // Check if coordinates are within Accra
    if (!isWithinAccra(lat, lng)) {
      alert('⚠️ Sorry, we only deliver within Accra, Ghana. Please enter coordinates within Accra bounds.');
      return;
    }

    const location = {
      coordinates: [lat, lng],
      address: `Accra Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`
    };
    
    onLocationSet(location);
    setManualCoords({ lat: '', lng: '' });
  };

  return (
    <div className="location-input-panel">
      <h4>
        <i className="fas fa-map-marker-alt"></i>
        Set Delivery Location
        <span className="delivery-area-badge">📍 Accra Only</span>
      </h4>
      
      {/* Current Location Display */}
      {currentLocation && (
        <div className="current-location">
          <p><strong>Current:</strong> {currentLocation.address}</p>
          <small>
            📍 {currentLocation.coordinates[0].toFixed(4)}, {currentLocation.coordinates[1].toFixed(4)}
          </small>
        </div>
      )}

      {/* Delivery Area Notice */}
      <div className="delivery-notice">
        <i className="fas fa-info-circle"></i>
        <span>We deliver only within Accra, Ghana</span>
      </div>

      {/* Input Method Selector */}
      <div className="input-method-selector">
        <button 
          className={`method-btn ${inputMethod === 'address' ? 'active' : ''}`}
          onClick={() => setInputMethod('address')}
        >
          <i className="fas fa-search"></i> Address
        </button>
        <button 
          className={`method-btn ${inputMethod === 'coordinates' ? 'active' : ''}`}
          onClick={() => setInputMethod('coordinates')}
        >
          <i className="fas fa-crosshairs"></i> Coordinates
        </button>
      </div>

      {/* Address Input */}
      {inputMethod === 'address' && (
        <form onSubmit={handleAddressSubmit} className="location-form">
          <div className="input-group">
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="Enter address in Accra (e.g., East Legon, Parliament House)"
              className="address-input"
              disabled={isGeocoding}
            />
            <button 
              type="submit" 
              className="search-btn"
              disabled={isGeocoding || !addressInput.trim()}
            >
              {isGeocoding ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-search"></i>
              )}
            </button>
          </div>
          <small className="input-hint">
            Try: "East Legon", "Parliament House", "Osu Castle", "University of Ghana"
          </small>
        </form>
      )}

      {/* Coordinates Input */}
      {inputMethod === 'coordinates' && (
        <form onSubmit={handleCoordinatesSubmit} className="location-form">
          <div className="coords-inputs">
            <input
              type="number"
              step="any"
              value={manualCoords.lat}
              onChange={(e) => setManualCoords({...manualCoords, lat: e.target.value})}
              placeholder="Latitude (5.3 - 5.8)"
              className="coord-input"
            />
            <input
              type="number"
              step="any"
              value={manualCoords.lng}
              onChange={(e) => setManualCoords({...manualCoords, lng: e.target.value})}
              placeholder="Longitude (-0.4 - 0.1)"
              className="coord-input"
            />
          </div>
          <button 
            type="submit" 
            className="set-location-btn"
            disabled={!manualCoords.lat || !manualCoords.lng}
          >
            <i className="fas fa-map-pin"></i>
            Set Accra Location
          </button>
          <small className="input-hint">
            Coordinates must be within Accra bounds
          </small>
        </form>
      )}

      {/* Accra Area Quick Locations */}
      <div className="quick-locations">
        <small>Popular Accra locations:</small>
        <div className="location-chips">
          <button 
            className="location-chip"
            onClick={() => onLocationSet({
              coordinates: [5.6037, -0.1870],
              address: 'East Legon, Accra, Ghana'
            })}
          >
            🏘️ East Legon
          </button>
          <button 
            className="location-chip"
            onClick={() => onLocationSet({
              coordinates: [5.5500, -0.2167],
              address: 'Parliament House, Accra, Ghana'
            })}
          >
            🏛️ Parliament House
          </button>
          <button 
            className="location-chip"
            onClick={() => onLocationSet({
              coordinates: [5.5563, -0.1969],
              address: 'Osu, Accra, Ghana'
            })}
          >
            🌆 Osu
          </button>
          <button 
            className="location-chip"
            onClick={() => onLocationSet({
              coordinates: [5.6519, -0.1861],
              address: 'University of Ghana, Legon'
            })}
          >
            🎓 University of Ghana
          </button>
          <button 
            className="location-chip"
            onClick={() => onLocationSet({
              coordinates: [5.5697, -0.2318],
              address: 'Kotoka International Airport, Accra'
            })}
          >
            ✈️ Airport
          </button>
          <button 
            className="location-chip"
            onClick={() => onLocationSet({
              coordinates: [5.5336, -0.2058],
              address: 'Labadi Beach, Accra'
            })}
          >
            🏖️ Labadi Beach
          </button>
        </div>
      </div>

      {/* Delivery Coverage Map Info */}
      <div className="coverage-info">
        <small>
          <i className="fas fa-truck"></i>
          <strong>Delivery Coverage:</strong> Greater Accra Metropolitan Area
        </small>
      </div>
    </div>
  );
};

export default LocationInput;